import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { decode as base64Decode } from "https://deno.land/std@0.208.0/encoding/base64.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// Verify admin token with HMAC-SHA256 signature
async function verifyAdminToken(token: string): Promise<{ valid: boolean; adminId?: string }> {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return { valid: false };

    const [header, body, sig] = parts;
    const secret = Deno.env.get('ADMIN_PASSWORD');
    if (!secret) {
      console.error('[upload-question-paper] ADMIN_PASSWORD not configured');
      return { valid: false };
    }

    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      'raw',
      encoder.encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['verify']
    );

    const sigBytes = base64Decode(sig);
    const signatureValid = await crypto.subtle.verify(
      'HMAC',
      key,
      new Uint8Array(sigBytes).buffer,
      encoder.encode(`${header}.${body}`)
    );

    if (!signatureValid) return { valid: false };

    const payload = JSON.parse(new TextDecoder().decode(base64Decode(body)));
    if (Date.now() > payload.exp) return { valid: false };

    return { valid: true, adminId: payload.adminId };
  } catch {
    return { valid: false };
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Verify admin auth
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = authHeader.replace("Bearer ", "");
    const tokenResult = await verifyAdminToken(token);
    if (!tokenResult.valid) {
      return new Response(JSON.stringify({ error: "Invalid admin token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const { test_id, action, images, mode } = body;

    // ── STATUS action: return current image counts ──
    if (action === "status") {
      if (!test_id) {
        return new Response(JSON.stringify({ error: "test_id required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: questions, error: qErr } = await supabaseAdmin
        .from("questions")
        .select("id, created_at")
        .eq("test_id", test_id);

      const questionCount = questions?.length || 0;
      let optionCount = 0;
      let lastUpdated: string | null = null;

      if (questions && questions.length > 0) {
        // Get latest created_at from questions
        lastUpdated = questions.reduce((latest: string, q: any) => {
          return q.created_at > latest ? q.created_at : latest;
        }, questions[0].created_at);

        const questionIds = questions.map((q: any) => q.id);
        const { count } = await supabaseAdmin
          .from("question_options")
          .select("id", { count: "exact", head: true })
          .in("question_id", questionIds);

        optionCount = count || 0;
      }

      return new Response(
        JSON.stringify({
          questionCount,
          optionCount,
          totalImages: questionCount + optionCount,
          lastUpdated,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── UPLOAD action (default) ──
    if (!test_id || !images || !Array.isArray(images) || images.length === 0) {
      return new Response(
        JSON.stringify({ error: "test_id and images array required" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const uploadMode = mode || "replace";

    // Verify test exists
    const { data: testData, error: testErr } = await supabaseAdmin
      .from("tests")
      .select("id, exam_date, shift")
      .eq("id", test_id)
      .single();

    if (testErr || !testData) {
      return new Response(JSON.stringify({ error: "Test not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Build storage path prefix
    const dateSlug = (testData.exam_date || "unknown").replace(/-/g, "");
    const shiftSlug = testData.shift.toLowerCase().replace(/\s+/g, "-");
    const storagePath = `${dateSlug}/${shiftSlug}`;

    // ── REPLACE mode: delete all existing data first ──
    if (uploadMode === "replace") {
      const { data: existingQuestions } = await supabaseAdmin
        .from("questions")
        .select("id")
        .eq("test_id", test_id);

      if (existingQuestions && existingQuestions.length > 0) {
        const qIds = existingQuestions.map((q: any) => q.id);
        await supabaseAdmin.from("question_options").delete().in("question_id", qIds);
      }
      await supabaseAdmin.from("questions").delete().eq("test_id", test_id);

      // Also clean storage folder
      const { data: storageFiles } = await supabaseAdmin.storage
        .from("question-papers")
        .list(storagePath);

      if (storageFiles && storageFiles.length > 0) {
        const paths = storageFiles.map((f: any) => `${storagePath}/${f.name}`);
        await supabaseAdmin.storage.from("question-papers").remove(paths);
      }
    }

    // Upload images to storage and build question map
    const questionMap = new Map<
      number,
      { imageUrl: string; options: { num: number; url: string }[] }
    >();

    for (const img of images) {
      const fileData = base64Decode(img.data);
      const filePath = `${storagePath}/${img.path}`;

      const { error: uploadErr } = await supabaseAdmin.storage
        .from("question-papers")
        .upload(filePath, fileData, {
          contentType: "image/jpeg",
          upsert: true,
        });

      if (uploadErr) {
        console.error(`Upload error for ${filePath}:`, uploadErr);
        continue;
      }

      const url = filePath;

      if (img.option_number) {
        if (!questionMap.has(img.question_number)) {
          questionMap.set(img.question_number, { imageUrl: "", options: [] });
        }
        questionMap.get(img.question_number)!.options.push({
          num: img.option_number,
          url,
        });
      } else {
        if (!questionMap.has(img.question_number)) {
          questionMap.set(img.question_number, { imageUrl: url, options: [] });
        } else {
          questionMap.get(img.question_number)!.imageUrl = url;
        }
      }
    }

    // Create/upsert DB records
    let questionsCreated = 0;
    let questionsUpdated = 0;
    let optionsCreated = 0;

    for (const [qNum, qData] of questionMap) {
      if (!qData.imageUrl) continue;

      if (uploadMode === "merge") {
        // Check if question already exists
        const { data: existing } = await supabaseAdmin
          .from("questions")
          .select("id")
          .eq("test_id", test_id)
          .eq("question_number", qNum)
          .maybeSingle();

        if (existing) {
          // Update existing question
          await supabaseAdmin
            .from("questions")
            .update({ question_image_url: qData.imageUrl })
            .eq("id", existing.id);

          questionsUpdated++;

          // Upsert options
          if (qData.options.length > 0) {
            for (const opt of qData.options) {
              const { data: existingOpt } = await supabaseAdmin
                .from("question_options")
                .select("id")
                .eq("question_id", existing.id)
                .eq("option_number", opt.num)
                .maybeSingle();

              if (existingOpt) {
                await supabaseAdmin
                  .from("question_options")
                  .update({ option_image_url: opt.url })
                  .eq("id", existingOpt.id);
              } else {
                await supabaseAdmin.from("question_options").insert({
                  question_id: existing.id,
                  option_number: opt.num,
                  option_image_url: opt.url,
                });
                optionsCreated++;
              }
            }
          }
          continue;
        }
      }

      // Insert new question (replace mode or merge mode with no existing)
      const { data: qRecord, error: qErr } = await supabaseAdmin
        .from("questions")
        .insert({
          test_id,
          question_number: qNum,
          question_image_url: qData.imageUrl,
        })
        .select("id")
        .single();

      if (qErr || !qRecord) {
        console.error(`Failed to create question ${qNum}:`, qErr);
        continue;
      }
      questionsCreated++;

      if (qData.options.length > 0) {
        const optionRows = qData.options.map((opt) => ({
          question_id: qRecord.id,
          option_number: opt.num,
          option_image_url: opt.url,
        }));

        const { error: optErr } = await supabaseAdmin
          .from("question_options")
          .insert(optionRows);

        if (optErr) {
          console.error(`Failed to create options for Q${qNum}:`, optErr);
        } else {
          optionsCreated += qData.options.length;
        }
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        mode: uploadMode,
        questionsCreated,
        questionsUpdated,
        optionsCreated,
        storagePath,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (err) {
    console.error("Error:", err);
    return new Response(
      JSON.stringify({ error: err.message || "Internal error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
