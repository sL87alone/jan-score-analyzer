import { encode as base64Encode, decode as base64Decode } from "https://deno.land/std@0.208.0/encoding/base64.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Simple timing-safe comparison
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) {
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

// Simple rate limiting using in-memory store
const loginAttempts = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const record = loginAttempts.get(ip);
  
  if (!record || now > record.resetAt) {
    loginAttempts.set(ip, { count: 1, resetAt: now + 60000 });
    return true;
  }
  
  if (record.count >= 5) {
    return false;
  }
  
  record.count++;
  return true;
}

// Create a simple JWT-like token (base64 encoded JSON with signature)
async function createToken(payload: { adminId: string; exp: number }): Promise<string> {
  const secret = Deno.env.get('ADMIN_PASSWORD') || 'fallback-secret';
  const header = base64Encode(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const body = base64Encode(JSON.stringify(payload));
  
  // Create signature using HMAC-SHA256
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  
  const signature = await crypto.subtle.sign(
    'HMAC',
    key,
    encoder.encode(`${header}.${body}`)
  );
  
  const sig = base64Encode(new Uint8Array(signature));
  return `${header}.${body}.${sig}`;
}

// Verify and decode token
async function verifyToken(token: string): Promise<{ adminId: string; exp: number } | null> {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    
    const [header, body, sig] = parts;
    const secret = Deno.env.get('ADMIN_PASSWORD') || 'fallback-secret';
    
    // Verify signature
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
      console.log('[admin-auth] Invalid signature');
      return null;
    }
    
    // Decode payload
    const payload = JSON.parse(new TextDecoder().decode(base64Decode(body)));
    
    // Check expiration
    if (Date.now() > payload.exp) {
      console.log('[admin-auth] Token expired');
      return null;
    }
    
    return payload;
  } catch (e) {
    console.error('[admin-auth] Token verification error:', e);
    return null;
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const url = new URL(req.url);
  const action = url.searchParams.get('action') || 'login';
  
  console.log(`[admin-auth] Action: ${action}`);

  try {
    if (action === 'login') {
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

      const expectedAdminId = Deno.env.get('ADMIN_ID');
      const expectedPassword = Deno.env.get('ADMIN_PASSWORD');

      if (!expectedAdminId || !expectedPassword) {
        console.error('[admin-auth] ADMIN_ID or ADMIN_PASSWORD not configured');
        return new Response(
          JSON.stringify({ error: 'Server configuration error' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const idMatch = timingSafeEqual(adminId, expectedAdminId);
      const passwordMatch = timingSafeEqual(password, expectedPassword);

      if (!idMatch || !passwordMatch) {
        console.log(`[admin-auth] Invalid credentials attempt for: ${adminId}`);
        return new Response(
          JSON.stringify({ error: 'Invalid admin ID or password' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Create JWT token (expires in 7 days)
      const expiresAt = Date.now() + 7 * 24 * 60 * 60 * 1000;
      const sessionToken = await createToken({ adminId, exp: expiresAt });
      
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

      const payload = await verifyToken(sessionToken);
      
      if (!payload) {
        return new Response(
          JSON.stringify({ valid: false, error: 'Session expired or invalid' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify({ valid: true, adminId: payload.adminId }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (action === 'logout') {
      // With JWT, logout is handled client-side by deleting the token
      console.log(`[admin-auth] Logout requested`);
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
