import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verify user is authenticated
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Create user-scoped client to verify auth
    const supabaseUser = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsErr } = await supabaseUser.auth.getClaims(token);
    if (claimsErr || !claimsData?.claims?.sub) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = claimsData.claims.sub;

    const { test_id, question_numbers } = await req.json();
    if (!test_id) {
      return new Response(JSON.stringify({ error: "test_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Service role client for storage signed URLs
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Verify user has a submission for this test
    const { data: sub } = await supabaseAdmin
      .from("submissions")
      .select("id")
      .eq("test_id", test_id)
      .eq("user_id", userId)
      .limit(1)
      .maybeSingle();

    // Also check if user is admin
    const { data: isAdmin } = await supabaseAdmin.rpc("has_role", {
      _user_id: userId,
      _role: "admin",
    });

    if (!sub && !isAdmin) {
      return new Response(JSON.stringify({ error: "Access denied" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch questions
    let query = supabaseAdmin
      .from("questions")
      .select("id, question_number, question_image_url")
      .eq("test_id", test_id)
      .order("question_number");

    if (question_numbers && Array.isArray(question_numbers) && question_numbers.length > 0) {
      query = query.in("question_number", question_numbers);
    }

    const { data: questions, error: qErr } = await query;
    if (qErr || !questions || questions.length === 0) {
      return new Response(JSON.stringify({ questions: [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch options
    const qIds = questions.map((q) => q.id);
    const { data: options } = await supabaseAdmin
      .from("question_options")
      .select("question_id, option_number, option_image_url")
      .in("question_id", qIds)
      .order("option_number");

    // Generate signed URLs (30 min expiry)
    const EXPIRY = 60 * 30;
    const result = [];

    for (const q of questions) {
      // Signed URL for question image
      let questionUrl: string | null = null;
      if (q.question_image_url) {
        const { data: signedData } = await supabaseAdmin.storage
          .from("question-papers")
          .createSignedUrl(q.question_image_url, EXPIRY);
        questionUrl = signedData?.signedUrl || null;
      }

      // Signed URLs for options
      const qOptions = (options || [])
        .filter((o) => o.question_id === q.id)
        .sort((a, b) => a.option_number - b.option_number);

      const optionUrls = [];
      for (const opt of qOptions) {
        let optUrl: string | null = null;
        if (opt.option_image_url) {
          const { data: signedData } = await supabaseAdmin.storage
            .from("question-papers")
            .createSignedUrl(opt.option_image_url, EXPIRY);
          optUrl = signedData?.signedUrl || null;
        }
        optionUrls.push({
          option_number: opt.option_number,
          option_url: optUrl,
        });
      }

      result.push({
        question_number: q.question_number,
        question_url: questionUrl,
        options: optionUrls,
      });
    }

    return new Response(JSON.stringify({ questions: result }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("paper-signed-urls error:", err);
    return new Response(JSON.stringify({ error: err.message || "Internal error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
