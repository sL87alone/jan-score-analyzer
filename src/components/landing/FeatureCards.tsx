import { motion } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { TrendingUp, LayoutGrid, Share2 } from "lucide-react";

const features = [
  {
    icon: TrendingUp,
    title: "Expected Percentile (2025 reference)",
    description: "We estimate your percentile using Marks vs Percentile data from JEE Main 2025, mapped to your 2026 shift.",
  },
  {
    icon: LayoutGrid,
    title: "Section A vs Section B",
    description: "Instantly see MCQ vs Numerical performance — attempted, correct, wrong, and negatives.",
  },
  {
    icon: Share2,
    title: "Shareable report link",
    description: "Copy link / Download PDF in one click.",
  },
];

export function FeatureCards() {
  return (
    <section className="py-16 px-4">
      <div className="container mx-auto max-w-5xl">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          viewport={{ once: true }}
          className="text-center mb-12"
        >
          <h2 className="text-2xl md:text-3xl font-bold mb-3">What you'll get</h2>
          <p className="text-muted-foreground">Complete analysis in seconds</p>
        </motion.div>

        <div className="grid md:grid-cols-3 gap-6">
          {features.map((feature, index) => (
            <motion.div
              key={feature.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
              viewport={{ once: true }}
            >
              <Card className="h-full hover:shadow-lg transition-shadow border-border/50 bg-card/50 backdrop-blur-sm">
                <CardContent className="p-6">
                  <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-4">
                    <feature.icon className="w-6 h-6 text-primary" />
                  </div>
                  <h3 className="font-semibold text-lg mb-2">{feature.title}</h3>
                  <p className="text-muted-foreground text-sm leading-relaxed">
                    {feature.description}
                  </p>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
