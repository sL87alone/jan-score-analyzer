import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { decode as base64Decode } from "https://deno.land/std@0.208.0/encoding/base64.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// Verify admin token with HMAC-SHA256 signature
async function verifyAdminToken(token: string): Promise<{ valid: boolean; adminId?: string; error?: string }> {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) {
      return { valid: false, error: "Invalid token format" };
    }
    
    const [header, body, sig] = parts;
    const secret = Deno.env.get('ADMIN_PASSWORD');
    
    if (!secret) {
      console.error('[upload-answer-keys] ADMIN_PASSWORD not configured');
      return { valid: false, error: "Server configuration error" };
    }
    
    // Verify HMAC-SHA256 signature
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
    
    if (!signatureValid) {
      console.log('[upload-answer-keys] Invalid token signature');
      return { valid: false, error: "Invalid token signature" };
    }
    
    // Decode and check payload
    const payload = JSON.parse(new TextDecoder().decode(base64Decode(body)));
    
    // Check expiration
    if (Date.now() > payload.exp) {
      console.log('[upload-answer-keys] Token expired');
      return { valid: false, error: "Token expired" };
    }
    
    return { valid: true, adminId: payload.adminId };
  } catch (e) {
    console.error('[upload-answer-keys] Token verification error:', e);
    return { valid: false, error: "Token verification failed" };
  }
}

interface AnswerKeyRow {
  question_id: string;
  subject: string;
  question_type: string;
  correct_option_ids: string[] | null;
  correct_numeric_value: number | null;
  numeric_tolerance: number;
  is_cancelled: boolean;
  is_bonus: boolean;
}

interface RequestBody {
  exam_date: string;
  shift: string;
  keys: AnswerKeyRow[];
  mode?: "upsert" | "replace"; // default: upsert
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Validate admin token
    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Missing authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const token = authHeader.replace("Bearer ", "");
    
    // Verify token with HMAC signature
    const tokenResult = await verifyAdminToken(token);
    if (!tokenResult.valid) {
      return new Response(
        JSON.stringify({ error: tokenResult.error || "Invalid token" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    
    console.log(`[upload-answer-keys] Authenticated admin: ${tokenResult.adminId}`);

    // Parse request body
    const body: RequestBody = await req.json();
    const { exam_date, shift, keys, mode = "upsert" } = body;

    // Validate required fields
    if (!exam_date || !shift || !keys || !Array.isArray(keys) || keys.length === 0) {
      return new Response(
        JSON.stringify({ 
          error: "Missing required fields: exam_date, shift, and keys array are required" 
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate mode
    if (mode !== "upsert" && mode !== "replace") {
      return new Response(
        JSON.stringify({ error: "Invalid mode. Must be 'upsert' or 'replace'" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Upload request: ${exam_date} ${shift}, ${keys.length} keys, mode: ${mode}`);

    // Create Supabase client with service role key (bypasses RLS)
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // 1. Find the matching test by exam_date + shift
    const { data: existingTest, error: findError } = await supabase
      .from("tests")
      .select("id")
      .eq("exam_date", exam_date)
      .eq("shift", shift)
      .maybeSingle();

    if (findError) {
      console.error("Error finding test:", findError);
      return new Response(
        JSON.stringify({ error: `Database error: ${findError.message}` }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let testId: string;

    if (existingTest) {
      testId = existingTest.id;
      console.log("Found existing test:", testId);
    } else {
      // Test not found - return error asking admin to seed/create first
      return new Response(
        JSON.stringify({ 
          error: "Test not found. Please seed or create the test first from the Tests page.",
          details: { exam_date, shift }
        }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let deletedCount = 0;
    let insertedCount = 0;
    let updatedCount = 0;

    // 2. Handle Replace mode: delete existing keys first
    if (mode === "replace") {
      const { data: deletedData, error: deleteError } = await supabase
        .from("answer_keys")
        .delete()
        .eq("test_id", testId)
        .select("id");

      if (deleteError) {
        console.error("Error deleting existing keys:", deleteError);
        return new Response(
          JSON.stringify({ error: `Failed to delete existing keys: ${deleteError.message}` }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      deletedCount = deletedData?.length || 0;
      console.log(`Deleted ${deletedCount} existing keys for replace mode`);
    }

    // 3. Transform keys for insert/upsert
    const keysToUpsert = keys.map((key) => ({
      test_id: testId,
      question_id: key.question_id,
      subject: key.subject,
      question_type: key.question_type,
      correct_option_ids: key.correct_option_ids,
      correct_numeric_value: key.correct_numeric_value,
      numeric_tolerance: key.numeric_tolerance || 0,
      is_cancelled: key.is_cancelled || false,
      is_bonus: key.is_bonus || false,
    }));

    // 4. Insert or upsert answer keys
    if (mode === "replace") {
      // Simple insert for replace mode (we already deleted)
      const { error: insertError } = await supabase
        .from("answer_keys")
        .insert(keysToUpsert);

      if (insertError) {
        console.error("Error inserting keys:", insertError);
        return new Response(
          JSON.stringify({ error: `Failed to insert answer keys: ${insertError.message}` }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      insertedCount = keys.length;
    } else {
      // Upsert for merge mode (conflict on test_id, question_id)
      const { error: upsertError } = await supabase
        .from("answer_keys")
        .upsert(keysToUpsert, { 
          onConflict: "test_id,question_id",
        });

      if (upsertError) {
        console.error("Error upserting keys:", upsertError);
        return new Response(
          JSON.stringify({ error: `Failed to upsert answer keys: ${upsertError.message}` }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      // For upsert, we can't easily distinguish updated vs inserted
      updatedCount = keys.length;
    }

    // 5. Update test's updated_at timestamp
    const { error: updateError } = await supabase
      .from("tests")
      .update({ updated_at: new Date().toISOString() })
      .eq("id", testId);

    if (updateError) {
      console.error("Error updating test timestamp:", updateError);
      // Non-fatal, continue
    }

    // 6. Get final count for verification
    const { data: verifyData, error: verifyError } = await supabase
      .from("answer_keys")
      .select("subject")
      .eq("test_id", testId);

    if (verifyError) {
      console.error("Error verifying import:", verifyError);
    }

    const totalKeys = verifyData?.length || 0;
    const mathCount = verifyData?.filter(k => k.subject === "Mathematics").length || 0;
    const physicsCount = verifyData?.filter(k => k.subject === "Physics").length || 0;
    const chemistryCount = verifyData?.filter(k => k.subject === "Chemistry").length || 0;

    console.log(`Upload complete (${mode}): ${totalKeys} keys (M:${mathCount} P:${physicsCount} C:${chemistryCount})`);

    return new Response(
      JSON.stringify({
        success: true,
        testId,
        mode,
        deletedCount,
        insertedCount,
        updatedCount,
        upsertedCount: keys.length,
        totalKeys,
        breakdown: {
          mathematics: mathCount,
          physics: physicsCount,
          chemistry: chemistryCount,
        },
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : "Unknown error";
    console.error("Upload error:", err);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
