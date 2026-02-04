const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Allowed domains for response sheet URLs
const ALLOWED_DOMAINS = [
  "cdn3.digialm.com",
  "cdn.digialm.com",
  "digialm.com",
  "ntaresults.nic.in",
];

function isAllowedUrl(urlString: string): boolean {
  try {
    const url = new URL(urlString);
    return ALLOWED_DOMAINS.some(domain => url.hostname.includes(domain));
  } catch {
    return false;
  }
}

function sanitizeUrl(urlString: string): string {
  // Remove hash fragment and trim
  let sanitized = urlString.trim();
  const hashIndex = sanitized.indexOf("#");
  if (hashIndex !== -1) {
    sanitized = sanitized.substring(0, hashIndex);
  }
  return sanitized;
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { url } = await req.json();

    if (!url) {
      return new Response(
        JSON.stringify({ success: false, error: "URL is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate domain
    if (!isAllowedUrl(url)) {
      console.log("Rejected URL (not in allowed domains):", url);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: "URL must be from an allowed domain (digialm.com or ntaresults.nic.in)" 
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Sanitize URL
    const sanitizedUrl = sanitizeUrl(url);
    console.log("Fetching response sheet from:", sanitizedUrl);

    // Attempt to fetch the URL
    const response = await fetch(sanitizedUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.5",
      },
      redirect: "follow",
    });

    if (!response.ok) {
      console.error("Failed to fetch URL:", response.status, response.statusText);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: "Failed to fetch the URL. It may require login or session." 
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const contentType = response.headers.get("content-type") || "";
    
    // Check if it's HTML
    if (!contentType.includes("text/html")) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: "URL does not return HTML content." 
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const html = await response.text();

    // Basic validation that it looks like a response sheet
    if (html.length < 1000) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: "Response appears to be empty or requires login." 
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check for login indicators
    const loginIndicators = [
      "login", "sign in", "signin", "authenticate", "session expired", 
      "access denied", "unauthorized", "please login"
    ];
    
    const lowerHtml = html.toLowerCase();
    const hasLoginIndicator = loginIndicators.some(indicator => 
      lowerHtml.includes(indicator) && html.length < 5000
    );

    if (hasLoginIndicator) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: "Page requires login/authentication." 
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Log diagnostic info for debugging
    console.log("Successfully fetched HTML, length:", html.length);
    console.log("First 300 chars:", html.substring(0, 300));

    return new Response(
      JSON.stringify({ success: true, html }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in fetch-response-sheet:", error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : "Failed to fetch URL" 
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
