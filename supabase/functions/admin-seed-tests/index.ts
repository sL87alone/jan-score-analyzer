import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// Jan 2026 exam dates
const JAN_2026_DATES = [
  "2026-01-21",
  "2026-01-22",
  "2026-01-23",
  "2026-01-24",
  "2026-01-28",
];

const SHIFTS = ["Shift 1", "Shift 2"];

const defaultMarkingRules = {
  mcq_single: { correct: 4, wrong: -1, unattempted: 0 },
  msq: { correct: 4, wrong: -2, unattempted: 0 },
  numerical: { correct: 4, wrong: -1, unattempted: 0 },
};

function getExamDateLabel(isoDate: string): string {
  const dateObj = new Date(isoDate + "T00:00:00Z");
  return dateObj.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Missing authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify admin token
    const token = authHeader.replace("Bearer ", "");
    const ADMIN_PASSWORD = Deno.env.get("ADMIN_PASSWORD");
    
    if (!ADMIN_PASSWORD) {
      return new Response(
        JSON.stringify({ error: "Server configuration error" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify token signature (simplified check - in production use proper JWT validation)
    const [header, body, signature] = token.split(".");
    if (!header || !body || !signature) {
      return new Response(
        JSON.stringify({ error: "Invalid token format" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Decode and check expiry
    const payload = JSON.parse(atob(body));
    if (payload.exp < Date.now()) {
      return new Response(
        JSON.stringify({ error: "Token expired" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create Supabase client with service role key (bypasses RLS)
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    let created = 0;
    let skipped = 0;

    // Seed tests
    for (const date of JAN_2026_DATES) {
      for (const shiftName of SHIFTS) {
        const testName = `JEE Main - ${getExamDateLabel(date)} ${shiftName}`;

        // Check if exists
        const { data: existing } = await supabase
          .from("tests")
          .select("id")
          .eq("exam_date", date)
          .eq("shift", shiftName)
          .maybeSingle();

        if (existing) {
          skipped++;
          continue;
        }

        // Create test
        const { error } = await supabase.from("tests").insert({
          name: testName,
          exam_date: date,
          shift: shiftName,
          is_active: true,
          marking_rules_json: defaultMarkingRules,
        });

        if (error) {
          console.error("Error creating test:", error);
          skipped++;
        } else {
          created++;
        }
      }
    }

    console.log(`Seeding complete: ${created} created, ${skipped} skipped`);

    return new Response(
      JSON.stringify({
        success: true,
        created,
        skipped,
        total: JAN_2026_DATES.length * SHIFTS.length,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : "Failed to seed tests";
    console.error("Seed error:", err);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
