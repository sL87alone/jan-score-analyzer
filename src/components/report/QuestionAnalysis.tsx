import { useState, useMemo, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  CheckCircle,
  XCircle,
  MinusCircle,
  Search,
  Info,
  ChevronDown,
  ChevronUp,
  Filter,
  Image as ImageIcon,
  Loader2,
} from "lucide-react";
import { QuestionResult } from "@/lib/questionParser";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";

interface QuestionAnalysisProps {
  questionResults: QuestionResult[];
  testId?: string | null;
  isSharedView?: boolean;
}

type StatusTab = "wrong" | "correct" | "unattempted";
type SubjectFilter = "all" | "Mathematics" | "Physics" | "Chemistry";
type SectionFilter = "all" | "A" | "B";

interface SignedQuestionImage {
  question_number: number;
  question_url: string | null;
  options: { option_number: number; option_url: string | null }[];
}

export const QuestionAnalysis = ({ questionResults, testId, isSharedView = false }: QuestionAnalysisProps) => {
  const [subjectFilter, setSubjectFilter] = useState<SubjectFilter>("all");
  const [sectionFilter, setSectionFilter] = useState<SectionFilter>("all");
  const [activeTab, setActiveTab] = useState<StatusTab>("wrong");
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedQuestions, setExpandedQuestions] = useState<Set<string>>(new Set());
  const [showAllExpanded, setShowAllExpanded] = useState(false);
  const [questionImages, setQuestionImages] = useState<Map<number, SignedQuestionImage>>(new Map());
  const [imagesLoading, setImagesLoading] = useState(false);
  const [imagesError, setImagesError] = useState<string | null>(null);

  // Fetch signed URLs from edge function
  useEffect(() => {
    if (!testId || isSharedView) return;

    const fetchSignedUrls = async () => {
      setImagesLoading(true);
      setImagesError(null);
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        const accessToken = sessionData?.session?.access_token;
        if (!accessToken) {
          setImagesLoading(false);
          return;
        }

        const { data, error } = await supabase.functions.invoke("paper-signed-urls", {
          body: { test_id: testId },
        });

        if (error) {
          console.error("Failed to fetch signed URLs:", error);
          setImagesError("Could not load question images");
          setImagesLoading(false);
          return;
        }

        const questions: SignedQuestionImage[] = data?.questions || [];
        if (questions.length === 0) {
          setImagesLoading(false);
          return;
        }

        const imageMap = new Map<number, SignedQuestionImage>();
        for (const q of questions) {
          imageMap.set(q.question_number, q);
        }
        setQuestionImages(imageMap);
      } catch (err) {
        console.error("Failed to fetch question images:", err);
        setImagesError("Could not load question images");
      } finally {
        setImagesLoading(false);
      }
    };

    fetchSignedUrls();
  }, [testId, isSharedView]);

  // Filter questions by tab status
  const filterByStatus = (questions: QuestionResult[], status: StatusTab) => {
    return questions.filter(q => {
      if (subjectFilter !== "all" && q.subject !== subjectFilter) return false;
      if (sectionFilter !== "all" && q.section !== sectionFilter) return false;
      if (status === "correct" && !q.is_correct) return false;
      if (status === "wrong" && (q.is_correct || !q.attempted)) return false;
      if (status === "unattempted" && q.attempted) return false;
      if (searchQuery) {
        const searchNum = parseInt(searchQuery, 10);
        if (!isNaN(searchNum) && q.qno !== searchNum) return false;
        if (isNaN(searchNum) && !q.question_id.includes(searchQuery)) return false;
      }
      return true;
    });
  };

  const wrongQuestions = useMemo(() => filterByStatus(questionResults, "wrong"),
    [questionResults, subjectFilter, sectionFilter, searchQuery]);
  const correctQuestions = useMemo(() => filterByStatus(questionResults, "correct"),
    [questionResults, subjectFilter, sectionFilter, searchQuery]);
  const unattemptedQuestions = useMemo(() => filterByStatus(questionResults, "unattempted"),
    [questionResults, subjectFilter, sectionFilter, searchQuery]);

  const getQuestionsForTab = (tab: StatusTab) => {
    switch (tab) {
      case "wrong": return wrongQuestions;
      case "correct": return correctQuestions;
      case "unattempted": return unattemptedQuestions;
    }
  };

  const toggleExpand = (id: string) => {
    const newExpanded = new Set(expandedQuestions);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedQuestions(newExpanded);
  };

  const toggleAllExpanded = () => {
    const currentQuestions = getQuestionsForTab(activeTab);
    if (showAllExpanded) {
      setExpandedQuestions(new Set());
    } else {
      setExpandedQuestions(new Set(currentQuestions.map(q => q.question_id)));
    }
    setShowAllExpanded(!showAllExpanded);
  };

  const getStatusIcon = (q: QuestionResult) => {
    if (!q.attempted) return <MinusCircle className="w-4 h-4 text-muted-foreground" />;
    if (q.is_correct) return <CheckCircle className="w-4 h-4 text-success" />;
    return <XCircle className="w-4 h-4 text-destructive" />;
  };

  const getStatusLabel = (q: QuestionResult) => {
    if (!q.attempted) return "Unattempted";
    if (q.is_correct) return "Correct";
    return "Wrong";
  };

  const getSubjectColor = (subject: string) => {
    switch (subject) {
      case "Mathematics": return "bg-math text-white";
      case "Physics": return "bg-physics text-white";
      case "Chemistry": return "bg-chemistry text-white";
      default: return "bg-muted";
    }
  };

  const getSectionLabel = (section: string) => {
    return section === "A" ? "MCQ" : "Numerical";
  };

  const stats = useMemo(() => {
    const wrong = questionResults.filter(q => q.attempted && !q.is_correct).length;
    const correct = questionResults.filter(q => q.is_correct).length;
    const unattempted = questionResults.filter(q => !q.attempted).length;
    return { correct, wrong, unattempted, total: questionResults.length };
  }, [questionResults]);

  const hasImages = questionImages.size > 0;

  const renderQuestionList = (questions: QuestionResult[]) => (
    <div className="space-y-3 max-h-[600px] overflow-y-auto pr-2">
      {questions.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          No questions match the current filters
        </div>
      ) : (
        questions.map(q => {
          const qImage = questionImages.get(q.qno);
          return (
            <Collapsible
              key={q.question_id}
              open={expandedQuestions.has(q.question_id)}
              onOpenChange={() => toggleExpand(q.question_id)}
            >
              <div className={cn(
                "border rounded-lg overflow-hidden transition-colors",
                q.is_correct && q.attempted ? "border-success/30" : "",
                !q.is_correct && q.attempted ? "border-destructive/30" : ""
              )}>
                {/* Header */}
                <CollapsibleTrigger className="w-full p-3 flex items-center gap-3 hover:bg-muted/50 transition-colors">
                  <div className="flex items-center gap-2 flex-1">
                    {getStatusIcon(q)}
                    <span className="font-mono font-semibold">Q{q.qno}</span>
                    <Badge className={cn("text-xs", getSubjectColor(q.subject))}>
                      {q.subject.slice(0, 4)}
                    </Badge>
                    <Badge variant="outline" className="text-xs">
                      Sec {q.section} ({getSectionLabel(q.section)})
                    </Badge>
                    {qImage && qImage.question_url && (
                      <ImageIcon className="w-3 h-3 text-primary" />
                    )}
                    <Badge
                      variant="outline"
                      className={cn(
                        "text-xs ml-auto",
                        q.is_correct && q.attempted ? "border-success text-success" : "",
                        !q.is_correct && q.attempted ? "border-destructive text-destructive" : ""
                      )}
                    >
                      {q.marks_awarded > 0 ? `+${q.marks_awarded}` : q.marks_awarded}
                    </Badge>
                  </div>
                  <ChevronDown className={cn(
                    "w-4 h-4 transition-transform",
                    expandedQuestions.has(q.question_id) ? "rotate-180" : ""
                  )} />
                </CollapsibleTrigger>

                {/* Expanded content */}
                <CollapsibleContent>
                  <div className="p-3 pt-0 space-y-3 border-t bg-muted/20">
                    {/* Question Image from signed URL */}
                    {qImage && qImage.question_url && (
                      <img
                        src={qImage.question_url}
                        alt={`Question ${q.qno}`}
                        className="rounded max-w-full object-contain"
                        loading="lazy"
                      />
                    )}

                    {/* Fallback if no image */}
                    {!qImage && q.question_text && q.question_text !== `Question ${q.qno}` && (
                      <p className="text-sm text-muted-foreground line-clamp-3">
                        {q.question_text}
                      </p>
                    )}

                    {/* No image available message */}
                    {qImage && !qImage.question_url && (
                      <p className="text-sm text-muted-foreground italic">
                        Paper image not available for Q{q.qno}
                      </p>
                    )}

                    {/* MCQ Options with images from signed URLs */}
                    {qImage && qImage.options.length > 0 && q.section === "A" && (
                      <div className="space-y-2">
                        {qImage.options.map(opt => {
                          const optLabel = String.fromCharCode(64 + opt.option_number); // A,B,C,D
                          const optId = q.options.find(o => o.label === optLabel)?.id;
                          const isUserSelected = !isSharedView && String(q.user_answer) === optId;
                          const isCorrect = String(q.correct_answer) === optId;

                          return (
                            <div
                              key={opt.option_number}
                              className={cn(
                                "flex items-start gap-2 p-2 rounded border text-sm",
                                isCorrect ? "bg-success/10 border-success" : "",
                                isUserSelected && !isCorrect ? "bg-destructive/10 border-destructive" : "",
                                !isCorrect && !isUserSelected ? "border-border" : ""
                              )}
                            >
                              <span className="font-mono w-6 text-center mt-1">{optLabel}.</span>
                              <div className="flex-1">
                                {opt.option_url ? (
                                  <img
                                    src={opt.option_url}
                                    alt={`Option ${optLabel}`}
                                    className="rounded max-w-full object-contain max-h-24"
                                    loading="lazy"
                                  />
                                ) : (
                                  <span className="text-muted-foreground">Option {optLabel}</span>
                                )}
                              </div>
                              {isCorrect && <CheckCircle className="w-4 h-4 text-success mt-1" />}
                              {isUserSelected && !isCorrect && <XCircle className="w-4 h-4 text-destructive mt-1" />}
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {/* MCQ Options (text-only fallback when no images) */}
                    {(!qImage || qImage.options.length === 0) && q.options.length > 0 && (
                      <div className="space-y-2">
                        {q.options.map(opt => {
                          const isUserSelected = !isSharedView && String(q.user_answer) === opt.id;
                          const isCorrect = String(q.correct_answer) === opt.id;

                          return (
                            <div
                              key={opt.id}
                              className={cn(
                                "flex items-center gap-2 p-2 rounded border text-sm",
                                isCorrect ? "bg-success/10 border-success" : "",
                                isUserSelected && !isCorrect ? "bg-destructive/10 border-destructive" : "",
                                !isCorrect && !isUserSelected ? "border-border" : ""
                              )}
                            >
                              <span className="font-mono w-6 text-center">{opt.label}.</span>
                              <span className="flex-1">{opt.text || `Option ${opt.label}`}</span>
                              {isCorrect && <CheckCircle className="w-4 h-4 text-success" />}
                              {isUserSelected && !isCorrect && <XCircle className="w-4 h-4 text-destructive" />}
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {/* Numerical answer */}
                    {q.section === "B" && (
                      <div className="grid grid-cols-2 gap-3 text-sm">
                        <div className="p-2 rounded bg-muted">
                          <p className="text-xs text-muted-foreground mb-1">
                            {isSharedView ? "Answer" : "Your Answer"}
                          </p>
                          {!isSharedView ? (
                            <p className={cn(
                              "font-mono font-semibold",
                              q.is_correct ? "text-success" : q.attempted ? "text-destructive" : "text-muted-foreground"
                            )}>
                              {q.user_answer !== null ? String(q.user_answer) : "Not answered"}
                            </p>
                          ) : (
                            <p className="font-mono text-muted-foreground">Hidden</p>
                          )}
                        </div>
                        <div className="p-2 rounded bg-success/10">
                          <p className="text-xs text-muted-foreground mb-1">Correct Answer</p>
                          <p className="font-mono font-semibold text-success">
                            {q.correct_answer !== null ? String(q.correct_answer) : "N/A"}
                          </p>
                        </div>
                      </div>
                    )}

                    {/* Marks info */}
                    <div className="flex items-center gap-4 text-xs text-muted-foreground pt-2 border-t">
                      <span>Status: {getStatusLabel(q)}</span>
                      <span>
                        Marks: {q.marks_awarded > 0 ? `+${q.marks_awarded}` : q.marks_awarded}
                        {q.negative > 0 && ` (−${q.negative} negative)`}
                      </span>
                      <span className="font-mono text-xs">ID: {q.question_id}</span>
                    </div>
                  </div>
                </CollapsibleContent>
              </div>
            </Collapsible>
          );
        })
      )}
    </div>
  );

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-2">
            <CardTitle>Question-wise Paper Review</CardTitle>
            {imagesLoading && <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />}
            {hasImages && (
              <Badge variant="outline" className="text-xs border-primary text-primary">
                <ImageIcon className="w-3 h-3 mr-1" />
                Images
              </Badge>
            )}
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger>
                  <Info className="w-4 h-4 text-muted-foreground" />
                </TooltipTrigger>
                <TooltipContent className="max-w-xs">
                  <div className="space-y-2 text-sm">
                    <p className="font-semibold">Marking Rules:</p>
                    <p>• Section A (MCQ): +4 correct, -1 wrong, 0 unattempted</p>
                    <p>• Section B (Numerical): +4 correct, 0 wrong/unattempted</p>
                    {hasImages && <p>• Question images are available for this test</p>}
                    <p className="text-xs text-muted-foreground mt-2">This data is private and only visible to you.</p>
                  </div>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
          <Button variant="outline" size="sm" onClick={toggleAllExpanded}>
            {showAllExpanded ? (
              <>
                <ChevronUp className="w-4 h-4 mr-1" />
                Collapse All
              </>
            ) : (
              <>
                <ChevronDown className="w-4 h-4 mr-1" />
                Expand All
              </>
            )}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {imagesError && (
          <div className="text-sm text-destructive bg-destructive/10 p-2 rounded">
            {imagesError}
          </div>
        )}

        {/* Filters row */}
        <div className="flex flex-wrap gap-3 p-3 bg-muted/50 rounded-lg">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-muted-foreground" />
          </div>
          <Select value={subjectFilter} onValueChange={(v) => setSubjectFilter(v as SubjectFilter)}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Subject" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Subjects</SelectItem>
              <SelectItem value="Mathematics">Mathematics</SelectItem>
              <SelectItem value="Physics">Physics</SelectItem>
              <SelectItem value="Chemistry">Chemistry</SelectItem>
            </SelectContent>
          </Select>

          <Select value={sectionFilter} onValueChange={(v) => setSectionFilter(v as SectionFilter)}>
            <SelectTrigger className="w-[130px]">
              <SelectValue placeholder="Section" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Sections</SelectItem>
              <SelectItem value="A">Section A (MCQ)</SelectItem>
              <SelectItem value="B">Section B (Num)</SelectItem>
            </SelectContent>
          </Select>

          <div className="relative flex-1 min-w-[150px]">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Q# or ID"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8"
            />
          </div>
        </div>

        {/* Tabs for Wrong/Correct/Unattempted */}
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as StatusTab)} className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="wrong" className="gap-2">
              <XCircle className="w-4 h-4 text-destructive" />
              Wrong ({stats.wrong})
            </TabsTrigger>
            <TabsTrigger value="correct" className="gap-2">
              <CheckCircle className="w-4 h-4 text-success" />
              Correct ({stats.correct})
            </TabsTrigger>
            <TabsTrigger value="unattempted" className="gap-2">
              <MinusCircle className="w-4 h-4" />
              Unattempted ({stats.unattempted})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="wrong" className="mt-4">
            {renderQuestionList(wrongQuestions)}
          </TabsContent>

          <TabsContent value="correct" className="mt-4">
            {renderQuestionList(correctQuestions)}
          </TabsContent>

          <TabsContent value="unattempted" className="mt-4">
            {renderQuestionList(unattemptedQuestions)}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
};
