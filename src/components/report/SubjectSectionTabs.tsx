import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { SubjectSectionBreakdown, SectionStats } from "@/lib/sectionStats";

interface SubjectSectionTabsProps {
  subjectSectionStats: SubjectSectionBreakdown;
  subjectStats: Array<{
    subject: string;
    marks: number;
    attempted: number;
    correct: number;
    wrong: number;
    unattempted: number;
    accuracy: number;
  }>;
}

export const SubjectSectionTabs = ({ subjectSectionStats, subjectStats }: SubjectSectionTabsProps) => {
  const [sectionFilter, setSectionFilter] = useState<"all" | "A" | "B">("all");

  const getFilteredStats = (subject: string) => {
    const sectionData = subjectSectionStats[subject];
    const overallStats = subjectStats.find((s) => s.subject === subject) || {
      marks: 0,
      attempted: 0,
      correct: 0,
      wrong: 0,
      unattempted: 0,
      accuracy: 0,
    };

    if (sectionFilter === "all" || !sectionData) {
      return overallStats;
    }

    const s: SectionStats = sectionData[sectionFilter];
    return {
      marks: s.marks,
      attempted: s.attempted,
      correct: s.correct,
      wrong: s.wrong,
      unattempted: s.total - s.attempted,
      accuracy: s.attempted > 0 ? Math.round((s.correct / s.attempted) * 100) : 0,
    };
  };

  return (
    <Tabs defaultValue="Mathematics">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
        <TabsList className="grid w-full sm:w-auto grid-cols-3">
          <TabsTrigger value="Mathematics" className="gap-2">
            <span className="w-3 h-3 rounded-full bg-math" />
            Math
          </TabsTrigger>
          <TabsTrigger value="Physics" className="gap-2">
            <span className="w-3 h-3 rounded-full bg-physics" />
            Physics
          </TabsTrigger>
          <TabsTrigger value="Chemistry" className="gap-2">
            <span className="w-3 h-3 rounded-full bg-chemistry" />
            Chemistry
          </TabsTrigger>
        </TabsList>

        <ToggleGroup
          type="single"
          value={sectionFilter}
          onValueChange={(v) => v && setSectionFilter(v as "all" | "A" | "B")}
          className="justify-start"
        >
          <ToggleGroupItem value="all" aria-label="All sections" className="text-xs">
            All
          </ToggleGroupItem>
          <ToggleGroupItem value="A" aria-label="Section A" className="text-xs">
            Sec A (MCQ)
          </ToggleGroupItem>
          <ToggleGroupItem value="B" aria-label="Section B" className="text-xs">
            Sec B (Num)
          </ToggleGroupItem>
        </ToggleGroup>
      </div>

      {["Mathematics", "Physics", "Chemistry"].map((subject) => {
        const stats = getFilteredStats(subject);

        return (
          <TabsContent key={subject} value={subject} className="mt-4">
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <div className="p-4 rounded-lg bg-muted">
                <p className="text-2xl font-mono font-bold">{stats.marks}</p>
                <p className="text-sm text-muted-foreground">Marks</p>
              </div>
              <div className="p-4 rounded-lg bg-muted">
                <p className="text-2xl font-mono font-bold">{stats.attempted}</p>
                <p className="text-sm text-muted-foreground">Attempted</p>
              </div>
              <div className="p-4 rounded-lg bg-muted">
                <p className="text-2xl font-mono font-bold text-success">{stats.correct}</p>
                <p className="text-sm text-muted-foreground">Correct</p>
              </div>
              <div className="p-4 rounded-lg bg-muted">
                <p className="text-2xl font-mono font-bold text-destructive">{stats.wrong}</p>
                <p className="text-sm text-muted-foreground">Wrong</p>
              </div>
              <div className="p-4 rounded-lg bg-muted">
                <p className="text-2xl font-mono font-bold">{stats.accuracy}%</p>
                <p className="text-sm text-muted-foreground">Accuracy</p>
              </div>
            </div>
          </TabsContent>
        );
      })}
    </Tabs>
  );
};
