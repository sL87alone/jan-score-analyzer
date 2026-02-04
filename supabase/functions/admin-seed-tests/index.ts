import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { decode as base64Decode } from "https://deno.land/std@0.208.0/encoding/base64.ts";

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
      console.error('[admin-seed-tests] ADMIN_PASSWORD not configured');
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
      console.log('[admin-seed-tests] Invalid token signature');
      return { valid: false, error: "Invalid token signature" };
    }
    
    // Decode and check payload
    const payload = JSON.parse(new TextDecoder().decode(base64Decode(body)));
    
    // Check expiration
    if (Date.now() > payload.exp) {
      console.log('[admin-seed-tests] Token expired');
      return { valid: false, error: "Token expired" };
    }
    
    return { valid: true, adminId: payload.adminId };
  } catch (e) {
    console.error('[admin-seed-tests] Token verification error:', e);
    return { valid: false, error: "Token verification failed" };
  }
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

    // Verify admin token with HMAC signature
    const token = authHeader.replace("Bearer ", "");
    const tokenResult = await verifyAdminToken(token);
    
    if (!tokenResult.valid) {
      return new Response(
        JSON.stringify({ error: tokenResult.error || "Invalid token" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    
    console.log(`[admin-seed-tests] Authenticated admin: ${tokenResult.adminId}`);

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
