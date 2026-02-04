import { supabase } from "@/integrations/supabase/client";

export interface HealthCheckResult {
  ok: boolean;
  error?: string;
  latencyMs?: number;
}

export async function checkSupabaseConnection(): Promise<HealthCheckResult> {
  const start = performance.now();
  
  try {
    // Try a lightweight query - fetch one test row
    const { data, error } = await supabase
      .from("tests")
      .select("id")
      .limit(1);
    
    const latencyMs = Math.round(performance.now() - start);
    
    if (error) {
      return { ok: false, error: error.message, latencyMs };
    }
    
    return { ok: true, latencyMs };
  } catch (err) {
    const latencyMs = Math.round(performance.now() - start);
    const message = err instanceof Error ? err.message : "Unknown error";
    return { ok: false, error: message, latencyMs };
  }
}
