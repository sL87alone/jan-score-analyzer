import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, XCircle, Loader2, RefreshCw, Database, Clock, ArrowLeft } from "lucide-react";
import { Link } from "react-router-dom";
import { checkSupabaseConnection, HealthCheckResult } from "@/lib/supabaseHealth";
import { useAuth } from "@/contexts/AuthContext";

const DebugSupabase = () => {
  const [healthResult, setHealthResult] = useState<HealthCheckResult | null>(null);
  const [loading, setLoading] = useState(true);
  const { session, user, loading: authLoading } = useAuth();

  const runHealthCheck = async () => {
    setLoading(true);
    const result = await checkSupabaseConnection();
    setHealthResult(result);
    setLoading(false);
  };

  useEffect(() => {
    runHealthCheck();
  }, []);

  const envVars = {
    VITE_SUPABASE_URL: import.meta.env.VITE_SUPABASE_URL ? "✅ Set" : "❌ Missing",
    VITE_SUPABASE_PUBLISHABLE_KEY: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ? "✅ Set" : "❌ Missing",
    VITE_SUPABASE_PROJECT_ID: import.meta.env.VITE_SUPABASE_PROJECT_ID ? "✅ Set" : "❌ Missing",
  };

  return (
    <div className="min-h-screen bg-muted/30 p-6">
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="flex items-center gap-4">
          <Link to="/">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold">Supabase Debug</h1>
            <p className="text-muted-foreground">Connection health & environment check</p>
          </div>
        </div>

        {/* Connection Status */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Database className="w-5 h-5" />
                  Database Connection
                </CardTitle>
                <CardDescription>Real-time connection health check</CardDescription>
              </div>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={runHealthCheck}
                disabled={loading}
              >
                {loading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <RefreshCw className="w-4 h-4" />
                )}
              </Button>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Checking connection...
                </div>
              ) : healthResult?.ok ? (
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-green-600 dark:text-green-400">
                    <CheckCircle2 className="w-6 h-6" />
                    <span className="text-lg font-medium">Connected</span>
                  </div>
                  {healthResult.latencyMs && (
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Clock className="w-4 h-4" />
                      <span>Latency: {healthResult.latencyMs}ms</span>
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-destructive">
                    <XCircle className="w-6 h-6" />
                    <span className="text-lg font-medium">Connection Failed</span>
                  </div>
                  <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-md text-sm font-mono text-destructive">
                    {healthResult?.error || "Unknown error"}
                  </div>
                  {healthResult?.latencyMs && (
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Clock className="w-4 h-4" />
                      <span>Attempted for: {healthResult.latencyMs}ms</span>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* Environment Variables */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <Card>
            <CardHeader>
              <CardTitle>Environment Variables</CardTitle>
              <CardDescription>Required Supabase configuration</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {Object.entries(envVars).map(([key, status]) => (
                  <div key={key} className="flex items-center justify-between py-2 border-b last:border-0">
                    <code className="text-sm font-mono">{key}</code>
                    <span>{status}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Auth Status */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <Card>
            <CardHeader>
              <CardTitle>Authentication Status</CardTitle>
              <CardDescription>Current Supabase Auth session</CardDescription>
            </CardHeader>
            <CardContent>
              {authLoading ? (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Checking auth...
                </div>
              ) : session ? (
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Badge variant="default">Authenticated</Badge>
                  </div>
                  <div className="text-sm space-y-1">
                    <p><span className="text-muted-foreground">Email:</span> {user?.email}</p>
                    <p><span className="text-muted-foreground">User ID:</span> <code className="text-xs">{user?.id}</code></p>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <Badge variant="secondary">Not authenticated</Badge>
                  <span className="text-sm text-muted-foreground">(No active Supabase Auth session)</span>
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* Project Info */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <Card>
            <CardHeader>
              <CardTitle>Project Info</CardTitle>
              <CardDescription>Lovable Cloud connection details</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 text-sm">
                <div className="flex items-center justify-between py-2 border-b">
                  <span className="text-muted-foreground">Project ID</span>
                  <code className="text-xs">{import.meta.env.VITE_SUPABASE_PROJECT_ID || "N/A"}</code>
                </div>
                <div className="flex items-center justify-between py-2">
                  <span className="text-muted-foreground">URL</span>
                  <code className="text-xs">{import.meta.env.VITE_SUPABASE_URL || "N/A"}</code>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  );
};

export default DebugSupabase;
