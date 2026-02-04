import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Info } from "lucide-react";
import { SectionBreakdown } from "@/lib/sectionStats";

interface SectionBreakdownCardProps {
  sectionStats: SectionBreakdown;
}

export const SectionBreakdownCard = ({ sectionStats }: SectionBreakdownCardProps) => {
  const { A, B } = sectionStats;

  return (
    <Card className="mb-8">
      <CardHeader>
        <CardTitle>Section-wise Breakdown</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid md:grid-cols-2 gap-6">
          {/* Section A - MCQ */}
          <div className="p-4 rounded-lg border bg-muted/30">
            <div className="flex items-center gap-2 mb-4">
              <h3 className="font-semibold text-lg">Section A (MCQ)</h3>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger>
                    <Info className="w-4 h-4 text-muted-foreground" />
                  </TooltipTrigger>
                  <TooltipContent className="max-w-xs">
                    <p className="text-xs">
                      <strong>Marking:</strong> +4 correct, −1 wrong, 0 unattempted
                    </p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="text-center p-2 rounded bg-background">
                <p className="text-xl font-mono font-bold">{A.attempted}</p>
                <p className="text-xs text-muted-foreground">Attempted</p>
              </div>
              <div className="text-center p-2 rounded bg-background">
                <p className="text-xl font-mono font-bold text-success">{A.correct}</p>
                <p className="text-xs text-muted-foreground">Correct</p>
              </div>
              <div className="text-center p-2 rounded bg-background">
                <p className="text-xl font-mono font-bold text-destructive">{A.wrong}</p>
                <p className="text-xs text-muted-foreground">Wrong</p>
              </div>
              <div className="text-center p-2 rounded bg-background">
                <p className="text-xl font-mono font-bold text-destructive">−{A.negative}</p>
                <p className="text-xs text-muted-foreground">Negative</p>
              </div>
            </div>
            <div className="mt-3 pt-3 border-t">
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Total Marks</span>
                <span className="font-mono font-bold">{A.marks}</span>
              </div>
            </div>
          </div>

          {/* Section B - Numerical */}
          <div className="p-4 rounded-lg border bg-muted/30">
            <div className="flex items-center gap-2 mb-4">
              <h3 className="font-semibold text-lg">Section B (Numerical)</h3>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger>
                    <Info className="w-4 h-4 text-muted-foreground" />
                  </TooltipTrigger>
                  <TooltipContent className="max-w-xs">
                    <p className="text-xs">
                      <strong>Marking:</strong> +4 correct, 0 wrong (no negative), 0 unattempted
                    </p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="text-center p-2 rounded bg-background">
                <p className="text-xl font-mono font-bold">{B.attempted}</p>
                <p className="text-xs text-muted-foreground">Attempted</p>
              </div>
              <div className="text-center p-2 rounded bg-background">
                <p className="text-xl font-mono font-bold text-success">{B.correct}</p>
                <p className="text-xs text-muted-foreground">Correct</p>
              </div>
              <div className="text-center p-2 rounded bg-background">
                <p className="text-xl font-mono font-bold text-warning">{B.wrong}</p>
                <p className="text-xs text-muted-foreground">Incorrect</p>
              </div>
              <div className="text-center p-2 rounded bg-background">
                <p className="text-xl font-mono font-bold text-muted-foreground">0</p>
                <p className="text-xs text-muted-foreground">Negative</p>
              </div>
            </div>
            <div className="mt-3 pt-3 border-t space-y-1">
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Total Marks</span>
                <span className="font-mono font-bold">{B.marks}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-warning">Marks Lost (missed +4s)</span>
                <span className="font-mono text-warning">{B.marksLost}</span>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};