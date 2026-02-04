import { Link } from "react-router-dom";
import { ThemeToggle } from "./ThemeToggle";
import { Button } from "@/components/ui/button";
import { Zap } from "lucide-react";

export function Navbar() {
  return (
    <nav className="fixed top-0 left-0 right-0 z-50 glass border-b">
      <div className="container mx-auto px-4 h-16 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2 font-bold text-xl">
          <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
            <Zap className="w-5 h-5 text-primary-foreground" />
          </div>
          <span>JanScore</span>
        </Link>

        <div className="flex items-center gap-4">
          <Link to="/analyze">
            <Button variant="ghost" size="sm">
              Analyze
            </Button>
          </Link>
          <ThemeToggle />
        </div>
      </div>
    </nav>
  );
}
