import { ReactNode } from "react";
import { useLocation, Link } from "react-router-dom";
import { motion } from "framer-motion";
import { useAuth } from "@/contexts/AuthContext";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/landing/Footer";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, Lock } from "lucide-react";

export function RequireAuth({ children }: { children: ReactNode }) {
  const { session, loading } = useAuth();
  const location = useLocation();
  const currentPath = location.pathname + location.search;

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!session) {
    return (
      <div className="min-h-screen flex flex-col">
        <Navbar />
        <main className="flex-1 pt-24 pb-12 px-4 flex items-center justify-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
          >
            <Card className="max-w-md w-full">
              <CardContent className="pt-6 text-center space-y-4">
                <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto">
                  <Lock className="w-7 h-7 text-primary" />
                </div>
                <h2 className="text-xl font-semibold">Sign in to view your score</h2>
                <p className="text-sm text-muted-foreground">
                  You need an account to generate and view your ScoreX report.
                </p>
                <div className="flex flex-col gap-2 pt-2">
                  <Link to={`/auth?mode=signin&next=${encodeURIComponent(currentPath)}`}>
                    <Button className="w-full">Sign In</Button>
                  </Link>
                  <Link to={`/auth?mode=signup&next=${encodeURIComponent(currentPath)}`}>
                    <Button variant="outline" className="w-full">Sign Up</Button>
                  </Link>
                  <Link to="/">
                    <Button variant="ghost" className="w-full">Go to Home</Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </main>
        <Footer />
      </div>
    );
  }

  return <>{children}</>;
}
