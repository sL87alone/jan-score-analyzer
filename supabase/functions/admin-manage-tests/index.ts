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
       console.error('[admin-manage-tests] ADMIN_PASSWORD not configured');
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
       console.log('[admin-manage-tests] Invalid token signature');
       return { valid: false, error: "Invalid token signature" };
     }
     
     // Decode and check payload
     const payload = JSON.parse(new TextDecoder().decode(base64Decode(body)));
     
     // Check expiration
     if (Date.now() > payload.exp) {
       console.log('[admin-manage-tests] Token expired');
       return { valid: false, error: "Token expired" };
     }
     
     return { valid: true, adminId: payload.adminId };
   } catch (e) {
     console.error('[admin-manage-tests] Token verification error:', e);
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
     
     console.log(`[admin-manage-tests] Authenticated admin: ${tokenResult.adminId}`);
 
     // Create Supabase client with service role key (bypasses RLS)
     const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
     const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
     const supabase = createClient(supabaseUrl, supabaseServiceKey);
 
     const url = new URL(req.url);
     const action = url.searchParams.get("action");
 
     if (req.method === "POST" && action === "create") {
       const body = await req.json();
       const { name, shift, exam_date, marking_rules_json, is_active } = body;
 
       if (!name || !shift || !exam_date) {
         return new Response(
           JSON.stringify({ error: "Name, shift, and exam_date are required" }),
           { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
         );
       }
 
       const { data, error } = await supabase
         .from("tests")
         .insert({
           name,
           shift,
           exam_date,
           marking_rules_json: marking_rules_json || {},
           is_active: is_active ?? true,
         })
         .select()
         .single();
 
       if (error) {
         console.error("[admin-manage-tests] Create error:", error);
         return new Response(
           JSON.stringify({ error: error.message }),
           { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
         );
       }
 
       console.log(`[admin-manage-tests] Created test: ${data.id}`);
       return new Response(
         JSON.stringify({ success: true, test: data }),
         { headers: { ...corsHeaders, "Content-Type": "application/json" } }
       );
     }
 
     if (req.method === "POST" && action === "update") {
       const body = await req.json();
       const { id, name, shift, exam_date, marking_rules_json, is_active } = body;
 
       if (!id) {
         return new Response(
           JSON.stringify({ error: "Test ID is required" }),
           { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
         );
       }
 
       const updateData: Record<string, unknown> = {};
       if (name !== undefined) updateData.name = name;
       if (shift !== undefined) updateData.shift = shift;
       if (exam_date !== undefined) updateData.exam_date = exam_date;
       if (marking_rules_json !== undefined) updateData.marking_rules_json = marking_rules_json;
       if (is_active !== undefined) updateData.is_active = is_active;
 
       const { data, error } = await supabase
         .from("tests")
         .update(updateData)
         .eq("id", id)
         .select()
         .single();
 
       if (error) {
         console.error("[admin-manage-tests] Update error:", error);
         return new Response(
           JSON.stringify({ error: error.message }),
           { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
         );
       }
 
       console.log(`[admin-manage-tests] Updated test: ${id}`);
       return new Response(
         JSON.stringify({ success: true, test: data }),
         { headers: { ...corsHeaders, "Content-Type": "application/json" } }
       );
     }
 
     if (req.method === "POST" && action === "delete") {
       const body = await req.json();
       const { id } = body;
 
       if (!id) {
         return new Response(
           JSON.stringify({ error: "Test ID is required" }),
           { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
         );
       }
 
       // Delete associated answer keys first (cascade)
       await supabase.from("answer_keys").delete().eq("test_id", id);
 
       const { error } = await supabase.from("tests").delete().eq("id", id);
 
       if (error) {
         console.error("[admin-manage-tests] Delete error:", error);
         return new Response(
           JSON.stringify({ error: error.message }),
           { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
         );
       }
 
       console.log(`[admin-manage-tests] Deleted test: ${id}`);
       return new Response(
         JSON.stringify({ success: true }),
         { headers: { ...corsHeaders, "Content-Type": "application/json" } }
       );
     }
 
     return new Response(
       JSON.stringify({ error: "Invalid action. Use ?action=create|update|delete" }),
       { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
     );
   } catch (err) {
     const errorMessage = err instanceof Error ? err.message : "Failed to manage test";
     console.error("[admin-manage-tests] Error:", err);
     return new Response(
       JSON.stringify({ error: errorMessage }),
       { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
     );
   }
 });