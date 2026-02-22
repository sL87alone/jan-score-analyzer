import React from "react";
import { HelmetProvider } from "react-helmet-async";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ThemeProvider } from "@/components/ThemeProvider";
import { AuthProvider } from "@/contexts/AuthContext";
import { RequireAuth } from "@/components/RequireAuth";
import Landing from "./pages/Landing";
import Analyze from "./pages/Analyze";
import Result from "./pages/Result";
import Auth from "./pages/Auth";
import SharedResult from "./pages/SharedResult";
import AdminLogin from "./pages/AdminLogin";
import AdminTests from "./pages/AdminTests";
import AdminUploadKey from "./pages/AdminUploadKey";
import DebugSupabase from "./pages/DebugSupabase";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <HelmetProvider>
    <QueryClientProvider client={queryClient}>
      <ThemeProvider attribute="class" defaultTheme="light" enableSystem>
        <AuthProvider>
          <TooltipProvider>
            <Toaster />
            <Sonner />
            <BrowserRouter>
              <Routes>
            <Route path="/" element={<Landing />} />
                <Route path="/auth" element={<Auth />} />
                <Route path="/analyze" element={<RequireAuth><Analyze /></RequireAuth>} />
                <Route path="/result/:id" element={<RequireAuth><Result /></RequireAuth>} />
                <Route path="/r/:token" element={<SharedResult />} />
                <Route path="/admin" element={<AdminLogin />} />
                <Route path="/admin/tests" element={<AdminTests />} />
                <Route path="/admin/upload-key" element={<AdminUploadKey />} />
                <Route path="/debug/supabase" element={<DebugSupabase />} />
                {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
                <Route path="*" element={<NotFound />} />
              </Routes>
            </BrowserRouter>
          </TooltipProvider>
        </AuthProvider>
      </ThemeProvider>
    </QueryClientProvider>
  </HelmetProvider>
);

export default App;
