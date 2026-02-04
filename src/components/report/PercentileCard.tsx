import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, Info } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { PercentileResult } from "@/lib/percentile";

interface PercentileCardProps {
  percentileResult: PercentileResult;
  totalMarks: number;
}

export const PercentileCard = ({ percentileResult, totalMarks }: PercentileCardProps) => {
  const { displayValue, mapped2025ShiftDisplay, isBelow, isAbove } = percentileResult;

  if (!mapped2025ShiftDisplay) {
    return (
      <Card className="border-dashed">
        <CardContent className="pt-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-muted-foreground" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Estimated Percentile</p>
              <p className="text-lg font-medium text-muted-foreground">Not available for this shift</p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-gradient-to-br from-primary/10 to-primary/5 border-primary/20">
      <CardContent className="pt-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center">
              <TrendingUp className="w-6 h-6 text-primary" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <p className="text-sm text-muted-foreground">Estimated Percentile (Jan 2025)</p>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger>
                      <Info className="w-3.5 h-3.5 text-muted-foreground" />
                    </TooltipTrigger>
                    <TooltipContent className="max-w-xs">
                      <p className="text-xs">
                        Estimate based on Jan 2025 marks vs percentile data. Actual percentile may vary.
                      </p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="text-3xl font-mono font-bold text-primary">
                  {displayValue}
                </span>
                {(isBelow || isAbove) && (
                  <Badge variant="outline" className="text-xs">
                    {isBelow ? "Below range" : "Above range"}
                  </Badge>
                )}
              </div>
            </div>
          </div>
        </div>
        
        <div className="mt-4 pt-3 border-t border-primary/10">
          <p className="text-xs text-muted-foreground">
            Using mapped shift: <span className="font-medium">{mapped2025ShiftDisplay}</span>
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Your score: <span className="font-mono font-medium">{totalMarks}/300</span>
          </p>
        </div>
      </CardContent>
    </Card>
  );
};
