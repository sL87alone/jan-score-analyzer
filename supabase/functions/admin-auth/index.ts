import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Simple timing-safe comparison
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) {
    // Still do comparison to avoid timing leak on length
    let result = 0;
    for (let i = 0; i < a.length; i++) {
      result |= a.charCodeAt(i) ^ (b.charCodeAt(i % b.length) || 0);
    }
    return false;
  }
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

// Simple rate limiting using in-memory store (resets on function cold start)
const loginAttempts = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const record = loginAttempts.get(ip);
  
  if (!record || now > record.resetAt) {
    loginAttempts.set(ip, { count: 1, resetAt: now + 60000 }); // 1 minute window
    return true;
  }
  
  if (record.count >= 5) {
    return false;
  }
  
  record.count++;
  return true;
}

// Generate a simple session token
function generateSessionToken(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
}

// Store active sessions (in production, use Redis or DB)
const activeSessions = new Map<string, { adminId: string; expiresAt: number }>();

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const url = new URL(req.url);
  const action = url.searchParams.get('action') || 'login';
  
  console.log(`[admin-auth] Action: ${action}`);

  try {
    if (action === 'login') {
      // Rate limiting
      const clientIP = req.headers.get('x-forwarded-for') || req.headers.get('cf-connecting-ip') || 'unknown';
      if (!checkRateLimit(clientIP)) {
        console.log(`[admin-auth] Rate limit exceeded for IP: ${clientIP}`);
        return new Response(
          JSON.stringify({ error: 'Too many attempts. Try again later.' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const { adminId, password } = await req.json();
      
      if (!adminId || !password) {
        return new Response(
          JSON.stringify({ error: 'Admin ID and password are required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Get credentials from environment
      const expectedAdminId = Deno.env.get('ADMIN_ID');
      const expectedPassword = Deno.env.get('ADMIN_PASSWORD');

      if (!expectedAdminId || !expectedPassword) {
        console.error('[admin-auth] ADMIN_ID or ADMIN_PASSWORD not configured');
        return new Response(
          JSON.stringify({ error: 'Server configuration error' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Timing-safe comparison
      const idMatch = timingSafeEqual(adminId, expectedAdminId);
      const passwordMatch = timingSafeEqual(password, expectedPassword);

      if (!idMatch || !passwordMatch) {
        console.log(`[admin-auth] Invalid credentials attempt for: ${adminId}`);
        return new Response(
          JSON.stringify({ error: 'Invalid admin ID or password' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Generate session token
      const sessionToken = generateSessionToken();
      const expiresAt = Date.now() + 7 * 24 * 60 * 60 * 1000; // 7 days
      
      activeSessions.set(sessionToken, { adminId, expiresAt });
      
      console.log(`[admin-auth] Login successful for: ${adminId}`);

      return new Response(
        JSON.stringify({ 
          success: true, 
          sessionToken,
          adminId,
          expiresAt: new Date(expiresAt).toISOString()
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (action === 'verify') {
      const authHeader = req.headers.get('authorization');
      const sessionToken = authHeader?.replace('Bearer ', '');

      if (!sessionToken) {
        return new Response(
          JSON.stringify({ valid: false, error: 'No session token' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const session = activeSessions.get(sessionToken);
      
      if (!session || Date.now() > session.expiresAt) {
        if (session) {
          activeSessions.delete(sessionToken);
        }
        return new Response(
          JSON.stringify({ valid: false, error: 'Session expired or invalid' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify({ valid: true, adminId: session.adminId }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (action === 'logout') {
      const authHeader = req.headers.get('authorization');
      const sessionToken = authHeader?.replace('Bearer ', '');

      if (sessionToken) {
        activeSessions.delete(sessionToken);
        console.log(`[admin-auth] Logout successful`);
      }

      return new Response(
        JSON.stringify({ success: true }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ error: 'Invalid action' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[admin-auth] Error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
