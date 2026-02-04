import React from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ThemeProvider } from "@/components/ThemeProvider";
import { AuthProvider } from "@/contexts/AuthContext";
import Landing from "./pages/Landing";
import Analyze from "./pages/Analyze";
import Result from "./pages/Result";
import AdminLogin from "./pages/AdminLogin";
import AdminTests from "./pages/AdminTests";
import AdminUploadKey from "./pages/AdminUploadKey";
import DebugSupabase from "./pages/DebugSupabase";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem>
      <AuthProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <Routes>
              <Route path="/" element={<Landing />} />
              <Route path="/analyze" element={<Analyze />} />
              <Route path="/result/:id" element={<Result />} />
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
);

export default App;
