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
       console.error('[admin-fetch-tests] ADMIN_PASSWORD not configured');
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
       console.log('[admin-fetch-tests] Invalid token signature');
       return { valid: false, error: "Invalid token signature" };
     }
     
     // Decode and check payload
     const payload = JSON.parse(new TextDecoder().decode(base64Decode(body)));
     
     // Check expiration
     if (Date.now() > payload.exp) {
       console.log('[admin-fetch-tests] Token expired');
       return { valid: false, error: "Token expired" };
     }
     
     return { valid: true, adminId: payload.adminId };
   } catch (e) {
     console.error('[admin-fetch-tests] Token verification error:', e);
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
     
     console.log(`[admin-fetch-tests] Authenticated admin: ${tokenResult.adminId}`);
 
     // Create Supabase client with service role key (bypasses RLS)
     const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
     const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
     const supabase = createClient(supabaseUrl, supabaseServiceKey);
 
     // Fetch all tests
     const { data: tests, error: testsError } = await supabase
       .from("tests")
       .select("*")
       .order("exam_date", { ascending: true })
       .order("shift", { ascending: true });
 
     if (testsError) {
       console.error("[admin-fetch-tests] Error fetching tests:", testsError);
       return new Response(
         JSON.stringify({ error: testsError.message }),
         { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
       );
     }
 
     if (!tests || tests.length === 0) {
       return new Response(
         JSON.stringify({ tests: [], keyCounts: {} }),
         { headers: { ...corsHeaders, "Content-Type": "application/json" } }
       );
     }
 
     // Fetch key counts for each test
     const testIds = tests.map(t => t.id);
     const { data: keyData, error: keyError } = await supabase
       .from("answer_keys")
       .select("test_id")
       .in("test_id", testIds);
 
     if (keyError) {
       console.error("[admin-fetch-tests] Error fetching key counts:", keyError);
     }
 
     // Count keys per test
     const keyCounts: Record<string, number> = {};
     keyData?.forEach(k => {
       keyCounts[k.test_id] = (keyCounts[k.test_id] || 0) + 1;
     });
 
     console.log(`[admin-fetch-tests] Returning ${tests.length} tests`);
 
     return new Response(
       JSON.stringify({ tests, keyCounts }),
       { headers: { ...corsHeaders, "Content-Type": "application/json" } }
     );
   } catch (err) {
     const errorMessage = err instanceof Error ? err.message : "Failed to fetch tests";
     console.error("[admin-fetch-tests] Error:", err);
     return new Response(
       JSON.stringify({ error: errorMessage }),
       { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
     );
   }
 });