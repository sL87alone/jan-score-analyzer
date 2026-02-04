import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import { ArrowRight, ChevronDown } from "lucide-react";
import heroPattern from "@/assets/hero-pattern.jpg";

export function Hero() {
  return (
    <section className="min-h-screen flex flex-col items-center justify-center pt-16 px-4 hero-gradient">
      <div className="container mx-auto max-w-4xl text-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <h1 className="text-4xl md:text-6xl lg:text-7xl font-extrabold tracking-tight mb-6 text-balance">
            Check your <span className="text-primary">Jan score</span> in 30 seconds.
          </h1>
        </motion.div>

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1 }}
          className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto mb-10"
        >
          Paste your JEE Main response-sheet link or upload your response HTML file. 
          Get total marks, accuracy, negative marks, subject-wise breakdown, and a shareable report.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="flex flex-col sm:flex-row gap-4 justify-center items-center"
        >
          <Link to="/analyze">
            <Button size="lg" className="glow-effect text-lg px-8 py-6 gap-2">
              Check My Jan Score
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

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 1, delay: 0.5 }}
          className="mt-16 flex justify-center"
        >
          <div className="relative w-full max-w-3xl aspect-video rounded-2xl overflow-hidden border shadow-2xl bg-card">
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-center p-8">
                <div className="score-card inline-block mb-4">
                  <span className="text-6xl font-mono font-bold">267</span>
                  <span className="text-2xl ml-1">/300</span>
                </div>
                <p className="text-muted-foreground">Sample score preview</p>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
