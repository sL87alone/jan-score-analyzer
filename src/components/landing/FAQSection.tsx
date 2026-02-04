import { motion } from "framer-motion";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { APP_NAME } from "@/lib/config";

const faqs = [
  {
    question: "Is this official percentile?",
    answer: "No, this is an estimate based on JEE Main 2025 marks vs percentile trends. Actual percentile depends on official NTA results.",
  },
  {
    question: "Why percentile differs by shift?",
    answer: "Different shifts have different difficulty levels. We map your 2026 shift to the closest 2025 shift based on difficulty patterns.",
  },
  {
    question: "What is Section A / Section B?",
    answer: "Section A contains MCQ questions (+4 correct, -1 wrong). Section B contains Numerical questions (+4 correct, 0 wrong — no negative marking).",
  },
  {
    question: "How negative marks are calculated?",
    answer: "MCQ wrong = -1 mark, Numerical wrong = 0 marks (no negative). Unattempted questions = 0 marks for both sections.",
  },
  {
    question: "Can I download my report?",
    answer: "Yes! You can download a PDF of your complete analysis or share a link with others.",
  },
];

export function FAQSection() {
  return (
    <section className="py-16 px-4 bg-muted/30">
      <div className="container mx-auto max-w-3xl">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          viewport={{ once: true }}
          className="text-center mb-10"
        >
          <h2 className="text-2xl md:text-3xl font-bold mb-3">
            Frequently Asked Questions
          </h2>
          <p className="text-muted-foreground">
            Common questions about {APP_NAME}
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          viewport={{ once: true }}
        >
          <Accordion type="single" collapsible className="space-y-3">
            {faqs.map((faq, index) => (
              <AccordionItem
                key={index}
                value={`item-${index}`}
                className="bg-card border rounded-xl px-4 data-[state=open]:shadow-sm"
              >
                <AccordionTrigger className="text-left hover:no-underline py-4">
                  <span className="font-medium">{faq.question}</span>
                </AccordionTrigger>
                <AccordionContent className="text-muted-foreground pb-4">
                  {faq.answer}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </motion.div>
      </div>
    </section>
  );
}
