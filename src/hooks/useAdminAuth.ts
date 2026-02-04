import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

interface AdminSession {
  adminId: string;
  sessionToken: string;
  expiresAt: string;
}

const STORAGE_KEY = "admin_session";

export function useAdminAuth() {
  const [session, setSession] = useState<AdminSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load session from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        const parsed = JSON.parse(stored) as AdminSession;
        // Check if expired
        if (new Date(parsed.expiresAt) > new Date()) {
          setSession(parsed);
          // Verify with server
          verifySession(parsed.sessionToken);
        } else {
          localStorage.removeItem(STORAGE_KEY);
        }
      } catch {
        localStorage.removeItem(STORAGE_KEY);
      }
    }
    setLoading(false);
  }, []);

  const verifySession = async (token: string) => {
    try {
      const { data, error } = await supabase.functions.invoke("admin-auth", {
        body: {},
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      // Handle query params for action
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-auth?action=verify`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
        }
      );

      const result = await response.json();

      if (!result.valid) {
        logout();
      }
    } catch (err) {
      console.error("Session verification failed:", err);
    }
  };

  const login = useCallback(async (adminId: string, password: string) => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-auth?action=login`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
          body: JSON.stringify({ adminId, password }),
        }
      );

      const result = await response.json();

      if (!response.ok) {
        setError(result.error || "Login failed");
        setLoading(false);
        return false;
      }

      const newSession: AdminSession = {
        adminId: result.adminId,
        sessionToken: result.sessionToken,
        expiresAt: result.expiresAt,
      };

      setSession(newSession);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(newSession));
      setLoading(false);
      return true;
    } catch (err) {
      console.error("Login error:", err);
      setError("An error occurred. Please try again.");
      setLoading(false);
      return false;
    }
  }, []);

  const logout = useCallback(async () => {
    if (session?.sessionToken) {
      try {
        await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-auth?action=logout`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${session.sessionToken}`,
              apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
            },
          }
        );
      } catch (err) {
        console.error("Logout error:", err);
      }
    }

    setSession(null);
    localStorage.removeItem(STORAGE_KEY);
  }, [session]);

  return {
    session,
    loading,
    error,
    login,
    logout,
    isAuthenticated: !!session,
    adminId: session?.adminId || null,
  };
}
