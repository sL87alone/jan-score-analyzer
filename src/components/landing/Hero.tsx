import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import { ArrowRight, ChevronDown, TrendingUp, LayoutGrid, Target } from "lucide-react";
import { Badge } from "@/components/ui/badge";

const featureBadges = [
  { icon: Target, label: "Marks + Accuracy" },
  { icon: LayoutGrid, label: "Section A/B Split" },
  { icon: TrendingUp, label: "Expected Percentile (2025)" },
];

export function Hero() {
  return (
    <section className="min-h-[90vh] flex flex-col items-center justify-center pt-16 px-4 hero-gradient">
      <div className="container mx-auto max-w-4xl text-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <h1 className="text-4xl md:text-6xl lg:text-7xl font-extrabold tracking-tight mb-6 text-balance">
            Check your <span className="text-primary">JEE score</span> + expected percentile in 30 seconds.
          </h1>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1 }}
          className="space-y-3 mb-8"
        >
          <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto">
            Paste your JEE Main response-sheet link or upload the HTML file.
          </p>
          <p className="text-base md:text-lg text-muted-foreground max-w-2xl mx-auto">
            Get marks, accuracy, negative, section-wise (A/B) breakdown, and expected percentile (based on JEE Main 2025 data).
          </p>
        </motion.div>

        {/* Feature Badges */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.15 }}
          className="flex flex-wrap justify-center gap-3 mb-10"
        >
          {featureBadges.map((badge, index) => (
            <Badge
              key={index}
              variant="secondary"
              className="px-4 py-2 text-sm font-medium bg-primary/10 text-primary border-primary/20 hover:bg-primary/15 transition-colors"
            >
              <badge.icon className="w-4 h-4 mr-2" />
              {badge.label}
            </Badge>
          ))}
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="flex flex-col sm:flex-row gap-4 justify-center items-center"
        >
          <Link to="/analyze">
            <Button size="lg" className="glow-effect text-lg px-8 py-6 gap-2">
              Check My Score
              <ArrowRight className="w-5 h-5" />
            </Button>
          </Link>
          <a href="#how-it-works">
            <Button variant="outline" size="lg" className="text-lg px-8 py-6 gap-2">
              How it works
              <ChevronDown className="w-5 h-5" />
            </Button>
          </a>
        </motion.div>
      </div>
    </section>
  );
}
