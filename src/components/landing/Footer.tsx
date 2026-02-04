import { Zap } from "lucide-react";
import { Link } from "react-router-dom";

export function Footer() {
  return (
    <footer className="py-12 px-4 border-t bg-muted/30">
      <div className="container mx-auto max-w-5xl">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
              <Zap className="w-5 h-5 text-primary-foreground" />
            </div>
            <span className="font-bold text-lg">JanScore</span>
          </div>

          <div className="flex items-center gap-6 text-sm text-muted-foreground">
            <Link to="/analyze" className="hover:text-foreground transition-colors">
              Analyze
            </Link>
            <Link to="/admin" className="hover:text-foreground transition-colors">
              Admin
            </Link>
          </div>
        </div>

        <div className="mt-8 pt-8 border-t text-center">
          <p className="text-sm text-muted-foreground max-w-2xl mx-auto">
            <strong>Disclaimer:</strong> This tool is for analysis only. Final score depends on official results 
            released by NTA. JanScore is not affiliated with NTA or any official body.
          </p>
          <p className="text-xs text-muted-foreground mt-4">
            © {new Date().getFullYear()} JanScore. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}
