import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

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
    
    // Verify token format and expiry
    const tokenParts = token.split(".");
    if (tokenParts.length !== 3) {
      return new Response(
        JSON.stringify({ error: "Invalid token format" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    try {
      const payload = JSON.parse(atob(tokenParts[1]));
      if (payload.exp < Date.now()) {
        return new Response(
          JSON.stringify({ error: "Token expired" }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    } catch {
      return new Response(
        JSON.stringify({ error: "Invalid token" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Parse request body
    const body: RequestBody = await req.json();
    const { exam_date, shift, keys } = body;

    // Validate required fields
    if (!exam_date || !shift || !keys || !Array.isArray(keys) || keys.length === 0) {
      return new Response(
        JSON.stringify({ 
          error: "Missing required fields: exam_date, shift, and keys array are required" 
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Upload request: ${exam_date} ${shift}, ${keys.length} keys`);

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

    // 2. Transform keys for upsert
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

    // 3. Upsert answer keys (conflict on test_id, question_id)
    const { error: upsertError, count } = await supabase
      .from("answer_keys")
      .upsert(keysToUpsert, { 
        onConflict: "test_id,question_id",
        count: "exact"
      });

    if (upsertError) {
      console.error("Error upserting keys:", upsertError);
      return new Response(
        JSON.stringify({ error: `Failed to upsert answer keys: ${upsertError.message}` }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 4. Get final count for verification
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

    console.log(`Upload complete: ${totalKeys} keys (M:${mathCount} P:${physicsCount} C:${chemistryCount})`);

    return new Response(
      JSON.stringify({
        success: true,
        testId,
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
