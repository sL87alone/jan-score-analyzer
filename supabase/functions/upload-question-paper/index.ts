import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { decode } from "https://deno.land/std@0.203.0/encoding/base64.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// Verify admin session token (same as other admin functions)
async function verifyAdminToken(
  token: string,
  supabaseAdmin: ReturnType<typeof createClient>
): Promise<boolean> {
  const adminId = Deno.env.get("ADMIN_ID");
  const adminPassword = Deno.env.get("ADMIN_PASSWORD");
  if (!adminId || !adminPassword) return false;

  // Decode the token (format: payload.signature)
  const parts = token.split(".");
  if (parts.length !== 2) return false;

  try {
    const payloadStr = atob(parts[0]);
    const payload = JSON.parse(payloadStr);

    // Check expiry
    if (new Date(payload.exp) < new Date()) return false;
    if (payload.adminId !== adminId) return false;

    // Verify signature
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      "raw",
      encoder.encode(adminPassword),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"]
    );
    const signatureBytes = await crypto.subtle.sign(
      "HMAC",
      key,
      encoder.encode(parts[0])
    );
    const expectedSig = btoa(
      String.fromCharCode(...new Uint8Array(signatureBytes))
    );

    return expectedSig === parts[1];
  } catch {
    return false;
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
    const isValid = await verifyAdminToken(token, supabaseAdmin);
    if (!isValid) {
      return new Response(JSON.stringify({ error: "Invalid admin token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const { test_id, images } = body;

    // images: Array<{ path: string, data: string (base64), question_number: number, option_number?: number }>
    if (!test_id || !images || !Array.isArray(images) || images.length === 0) {
      return new Response(
        JSON.stringify({ error: "test_id and images array required" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

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

    // Delete existing questions for this test (full replace)
    await supabaseAdmin.from("question_options").delete().in(
      "question_id",
      (
        await supabaseAdmin
          .from("questions")
          .select("id")
          .eq("test_id", test_id)
      ).data?.map((q: any) => q.id) || []
    );
    await supabaseAdmin.from("questions").delete().eq("test_id", test_id);

    // Upload images to storage and create DB records
    const questionMap = new Map<
      number,
      { imageUrl: string; options: { num: number; url: string }[] }
    >();

    // First pass: upload all images
    for (const img of images) {
      const fileData = decode(img.data);
      const filePath = `${storagePath}/${img.path}`;

      // Upload to storage (upsert)
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

      // Get public URL (signed URL since bucket is private)
      const {
        data: { publicUrl },
      } = supabaseAdmin.storage
        .from("question-papers")
        .getPublicUrl(filePath);

      // Store the URL - we'll use signed URLs on the client side
      const url = filePath; // Store path, generate signed URL on client

      if (img.option_number) {
        // This is an option image
        if (!questionMap.has(img.question_number)) {
          questionMap.set(img.question_number, { imageUrl: "", options: [] });
        }
        questionMap.get(img.question_number)!.options.push({
          num: img.option_number,
          url,
        });
      } else {
        // This is a question image
        if (!questionMap.has(img.question_number)) {
          questionMap.set(img.question_number, { imageUrl: url, options: [] });
        } else {
          questionMap.get(img.question_number)!.imageUrl = url;
        }
      }
    }

    // Second pass: create DB records
    let questionsCreated = 0;
    let optionsCreated = 0;

    for (const [qNum, qData] of questionMap) {
      if (!qData.imageUrl) continue;

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

      // Insert options
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
        questionsCreated,
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
