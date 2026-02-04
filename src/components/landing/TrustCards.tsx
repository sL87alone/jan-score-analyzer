import { motion } from "framer-motion";
import { Scale, Share2, Zap } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

const trustItems = [
  {
    icon: Scale,
    title: "Exam-style scoring rules",
    description: "Accurate marking based on official JEE Main patterns including MCQ, MSQ, and Numerical questions.",
  },
  {
    icon: Share2,
    title: "Shareable report link",
    description: "Generate a unique link to share your results with friends, teachers, or mentors.",
  },
  {
    icon: Zap,
    title: "Fast HTML-only analysis",
    description: "Instant parsing of your response sheet - no waiting, no complex uploads.",
  },
];

export function TrustCards() {
  return (
    <section className="py-20 px-4 bg-muted/30">
      <div className="container mx-auto max-w-6xl">
        <div className="grid md:grid-cols-3 gap-6">
          {trustItems.map((item, index) => (
            <motion.div
              key={item.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
              viewport={{ once: true }}
            >
              <Card className="h-full border-2 hover:border-primary/50 transition-colors">
                <CardContent className="pt-6">
                  <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-4">
                    <item.icon className="w-6 h-6 text-primary" />
                  </div>
                  <h3 className="text-lg font-semibold mb-2">{item.title}</h3>
                  <p className="text-muted-foreground text-sm">{item.description}</p>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
