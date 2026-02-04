import { motion } from "framer-motion";
import { Upload, CalendarDays, BarChart3, Share2 } from "lucide-react";

const steps = [
  {
    icon: Upload,
    number: "01",
    title: "Import response sheet",
    description: "Paste your JEE Main response sheet URL or upload the HTML file directly.",
  },
  {
    icon: CalendarDays,
    number: "02",
    title: "Select exam date + shift",
    description: "System auto-picks the correct answer key for your selected shift.",
  },
  {
    icon: BarChart3,
    number: "03",
    title: "Get score + percentile + breakdown",
    description: "Marks, accuracy, negatives, Section A/B breakdown, expected percentile, share link & PDF.",
  },
];

export function HowItWorks() {
  return (
    <section id="how-it-works" className="py-24 px-4">
      <div className="container mx-auto max-w-5xl">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <h2 className="text-3xl md:text-4xl font-bold mb-4">How it works</h2>
          <p className="text-muted-foreground text-lg">Three simple steps to your score</p>
        </motion.div>

        <div className="relative">
          {/* Connection line */}
          <div className="hidden md:block absolute top-1/2 left-0 right-0 h-0.5 bg-border -translate-y-1/2" />

          <div className="grid md:grid-cols-3 gap-8">
            {steps.map((step, index) => (
              <motion.div
                key={step.number}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: index * 0.15 }}
                viewport={{ once: true }}
                className="relative"
              >
                <div className="bg-card rounded-2xl p-6 border relative z-10">
                  <div className="flex items-center gap-4 mb-4">
                    <div className="w-14 h-14 rounded-xl bg-primary flex items-center justify-center shrink-0">
                      <step.icon className="w-7 h-7 text-primary-foreground" />
                    </div>
                    <span className="text-4xl font-bold text-muted-foreground/30 font-mono">
                      {step.number}
                    </span>
                  </div>
                  <h3 className="text-xl font-semibold mb-2">{step.title}</h3>
                  <p className="text-muted-foreground text-sm">{step.description}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
