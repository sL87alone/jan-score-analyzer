import { motion } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { Info, ArrowRight } from "lucide-react";
import { MAP_2026_TO_2025, formatShiftKeyForDisplay } from "@/lib/percentile";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { useState } from "react";
import { ChevronDown } from "lucide-react";

export function PercentileMappingInfo() {
  const [isOpen, setIsOpen] = useState(false);

  // Format shift keys for display
  const mappings = Object.entries(MAP_2026_TO_2025).map(([key2026, key2025]) => {
    const [date2026, shift2026] = key2026.split("_");
    const [, month2026, day2026] = date2026.split("-");
    const shiftName2026 = shift2026 === "S1" ? "Shift 1" : "Shift 2";
    
    const [date2025, shift2025] = key2025.split("_");
    const [, month2025, day2025] = date2025.split("-");
    const shiftName2025 = shift2025 === "S1" ? "Shift 1" : "Shift 2";

    return {
      from: `${parseInt(day2026)} Jan 2026 ${shiftName2026}`,
      to: `${parseInt(day2025)} Jan 2025 ${shiftName2025}`,
    };
  });

  return (
    <section className="py-12 px-4">
      <div className="container mx-auto max-w-4xl">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          viewport={{ once: true }}
        >
          <Card className="border-primary/20 bg-primary/5">
            <CardContent className="p-6">
              <div className="flex items-start gap-3 mb-4">
                <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                  <Info className="w-4 h-4 text-primary" />
                </div>
                <div>
                  <h3 className="font-semibold text-lg mb-1">
                    Shift-to-Shift Mapping (2026 → 2025)
                  </h3>
                  <p className="text-muted-foreground text-sm">
                    Percentile is calculated using 2025 marks distribution mapped to your selected 2026 shift for the closest difficulty match.
                  </p>
                </div>
              </div>

              <Collapsible open={isOpen} onOpenChange={setIsOpen}>
                <CollapsibleTrigger className="flex items-center gap-2 text-sm text-primary hover:underline cursor-pointer">
                  <span>View all mappings</span>
                  <ChevronDown className={`w-4 h-4 transition-transform ${isOpen ? "rotate-180" : ""}`} />
                </CollapsibleTrigger>
                <CollapsibleContent className="mt-4">
                  <div className="grid sm:grid-cols-2 gap-2">
                    {mappings.map((mapping, i) => (
                      <div
                        key={i}
                        className="flex items-center gap-2 text-sm py-2 px-3 rounded-lg bg-background/50"
                      >
                        <span className="font-medium">{mapping.from}</span>
                        <ArrowRight className="w-3 h-3 text-muted-foreground shrink-0" />
                        <span className="text-muted-foreground">{mapping.to}</span>
                      </div>
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground mt-3 italic">
                    Example: If you select 28 Jan 2026 Shift 1, we use 24 Jan 2025 Shift 1 marks→percentile table.
                  </p>
                </CollapsibleContent>
              </Collapsible>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </section>
  );
}
