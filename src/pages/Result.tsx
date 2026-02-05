import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { format } from "date-fns";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/landing/Footer";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Download,
  Copy,
  Trash2,
  CheckCircle,
  XCircle,
  MinusCircle,
  AlertTriangle,
  Target,
  TrendingDown,
  Loader2,
  Calendar,
  Clock,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Submission, Response as ResponseType, Test, SubjectStats } from "@/lib/types";
import { useToast } from "@/hooks/use-toast";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { SectionBreakdownCard } from "@/components/report/SectionBreakdownCard";
import { PercentileCard } from "@/components/report/PercentileCard";
import { SubjectSectionTabs } from "@/components/report/SubjectSectionTabs";
 import { QuestionAnalysis } from "@/components/report/QuestionAnalysis";
 import { QuestionResult } from "@/lib/questionParser";
import { APP_NAME } from "@/lib/config";
import {
  SectionBreakdown,
  SubjectSectionBreakdown,
  computeSectionStats,
  computeSubjectSectionStats,
} from "@/lib/sectionStats";
import { estimatePercentile, PercentileResult } from "@/lib/percentile";

const Result = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [submission, setSubmission] = useState<Submission | null>(null);
  const [responses, setResponses] = useState<ResponseType[]>([]);
  const [test, setTest] = useState<Test | null>(null);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);
  const [subjectStats, setSubjectStats] = useState<SubjectStats[]>([]);
  
  // Section-wise breakdown state
  const [sectionStats, setSectionStats] = useState<SectionBreakdown>({
    A: { attempted: 0, correct: 0, wrong: 0, negative: 0, marks: 0, marksLost: 0, total: 0 },
    B: { attempted: 0, correct: 0, wrong: 0, negative: 0, marks: 0, marksLost: 0, total: 0 },
  });
  const [subjectSectionStats, setSubjectSectionStats] = useState<SubjectSectionBreakdown>({
    Mathematics: {
      A: { attempted: 0, correct: 0, wrong: 0, negative: 0, marks: 0, marksLost: 0, total: 0 },
      B: { attempted: 0, correct: 0, wrong: 0, negative: 0, marks: 0, marksLost: 0, total: 0 },
    },
    Physics: {
      A: { attempted: 0, correct: 0, wrong: 0, negative: 0, marks: 0, marksLost: 0, total: 0 },
      B: { attempted: 0, correct: 0, wrong: 0, negative: 0, marks: 0, marksLost: 0, total: 0 },
    },
    Chemistry: {
      A: { attempted: 0, correct: 0, wrong: 0, negative: 0, marks: 0, marksLost: 0, total: 0 },
      B: { attempted: 0, correct: 0, wrong: 0, negative: 0, marks: 0, marksLost: 0, total: 0 },
    },
  });
  
  // Percentile state
  const [percentileResult, setPercentileResult] = useState<PercentileResult>({
    percentile: null,
    displayValue: "N/A",
    mapped2025Shift: null,
    mapped2025ShiftDisplay: null,
    isBelow: false,
    isAbove: false,
  });
  
  // Question-wise analysis data (owner only)
  const [questionResults, setQuestionResults] = useState<QuestionResult[]>([]);
 
  // Computed overall stats - single source of truth from responses
  const [computedStats, setComputedStats] = useState<{
    total_marks: number;
    total_attempted: number;
    total_correct: number;
    total_wrong: number;
    total_unattempted: number;
    accuracy_percentage: number;
    negative_marks: number;
    math_marks: number;
    physics_marks: number;
    chemistry_marks: number;
  } | null>(null);

  useEffect(() => {
    if (id) {
      fetchResults();
    }
  }, [id]);

  const fetchResults = async () => {
    try {
      // Fetch submission
      const { data: subData, error: subError } = await supabase
        .from("submissions")
        .select("*")
        .eq("id", id)
        .single();

      if (subError || !subData) {
        toast({
          title: "Error",
          description: "Result not found or has been deleted.",
          variant: "destructive",
        });
        navigate("/");
        return;
      }

      setSubmission(subData as unknown as Submission);

      // Extract question results if available (owner-only data)
      if (subData.question_results_json) {
        try {
          const results = typeof subData.question_results_json === 'string'
            ? JSON.parse(subData.question_results_json)
            : subData.question_results_json;
          if (Array.isArray(results)) {
            setQuestionResults(results as QuestionResult[]);
          }
        } catch (e) {
          console.error("Failed to parse question_results_json:", e);
        }
      }
 
      let testData: Test | null = null;
      
      // Fetch test info
      if (subData.test_id) {
        const { data: tData } = await supabase
          .from("tests")
          .select("*")
          .eq("id", subData.test_id)
          .single();

        if (tData) {
          testData = tData as unknown as Test;
          setTest(testData);
        }
      }

      // Fetch responses
      const { data: respData } = await supabase
        .from("responses")
        .select("*")
        .eq("submission_id", id)
        .order("question_id");

      // Fetch answer keys for section type determination
      let answerKeyMap: Map<string, { question_type: string; subject: string }> | undefined;
      
      if (subData.test_id) {
        const { data: keysData } = await supabase
          .from("answer_keys")
          .select("question_id, question_type, subject")
          .eq("test_id", subData.test_id);
        
        if (keysData && keysData.length > 0) {
          answerKeyMap = new Map();
          keysData.forEach((k) => {
            answerKeyMap!.set(String(k.question_id), {
              question_type: k.question_type,
              subject: k.subject,
            });
          });
        }
      }

      if (respData) {
        const typedResponses = respData as unknown as ResponseType[];
        setResponses(typedResponses);

        // Calculate subject stats from responses - SINGLE SOURCE OF TRUTH
        const stats: Record<string, SubjectStats & { negative: number }> = {};
        let totalMarks = 0;
        let totalAttempted = 0;
        let totalCorrect = 0;
        let totalWrong = 0;
        let totalUnattempted = 0;
        let totalNegative = 0;

        respData.forEach((r: any) => {
          const subject = r.subject || "Unknown";
          if (!stats[subject]) {
            stats[subject] = {
              subject,
              marks: 0,
              attempted: 0,
              correct: 0,
              wrong: 0,
              unattempted: 0,
              accuracy: 0,
              negative: 0,
            };
          }
          const marksAwarded = r.marks_awarded || 0;
          stats[subject].marks += marksAwarded;
          totalMarks += marksAwarded;
          
          if (r.status === "correct") {
            stats[subject].correct++;
            stats[subject].attempted++;
            totalCorrect++;
            totalAttempted++;
          } else if (r.status === "wrong") {
            stats[subject].wrong++;
            stats[subject].attempted++;
            totalWrong++;
            totalAttempted++;
            if (marksAwarded < 0) {
              stats[subject].negative += Math.abs(marksAwarded);
              totalNegative += Math.abs(marksAwarded);
            }
          } else if (r.status === "unattempted") {
            stats[subject].unattempted++;
            totalUnattempted++;
          }
        });

        Object.values(stats).forEach((s) => {
          s.accuracy = s.attempted > 0 ? Math.round((s.correct / s.attempted) * 100) : 0;
        });

        setSubjectStats(Object.values(stats));
        
        // Compute overall stats from responses (single source of truth)
        const mathStats = stats["Mathematics"] || { marks: 0 };
        const physicsStats = stats["Physics"] || { marks: 0 };
        const chemistryStats = stats["Chemistry"] || { marks: 0 };
        
        const computed = {
          total_marks: totalMarks,
          total_attempted: totalAttempted,
          total_correct: totalCorrect,
          total_wrong: totalWrong,
          total_unattempted: totalUnattempted,
          accuracy_percentage: totalAttempted > 0 
            ? Math.round((totalCorrect / totalAttempted) * 100 * 100) / 100 
            : 0,
          negative_marks: totalNegative,
          math_marks: mathStats.marks,
          physics_marks: physicsStats.marks,
          chemistry_marks: chemistryStats.marks,
        };
        
        setComputedStats(computed);
        
        // Compute section-wise breakdown
        const sectionBreakdown = computeSectionStats(typedResponses, answerKeyMap);
        setSectionStats(sectionBreakdown);
        
        // Compute subject-section breakdown
        const subjSectionBreakdown = computeSubjectSectionStats(typedResponses, answerKeyMap);
        setSubjectSectionStats(subjSectionBreakdown);
        
        // Calculate percentile if test has exam_date and shift
        if (testData?.exam_date && testData?.shift) {
          const percentile = estimatePercentile(totalMarks, testData.exam_date, testData.shift);
          setPercentileResult(percentile);
        }
        
        console.log("Computed stats from responses:", computed);
        console.log("Section stats:", sectionBreakdown);
      }
    } catch (err) {
      console.error("Error fetching results:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleCopyLink = async () => {
    // Use the share token link if available, otherwise use direct ID link
    const shareToken = submission?.share_token;
    const link = shareToken 
      ? `${window.location.origin}/r/${shareToken}`
      : window.location.href;
    await navigator.clipboard.writeText(link);
    toast({
      title: "Share Link Copied!",
      description: shareToken 
        ? "Secure share link has been copied to clipboard." 
        : "Link has been copied to clipboard.",
    });
  };

  const handleDownloadPDF = () => {
    if (!submission) return;

    const doc = new jsPDF();
    
    // Title
    doc.setFontSize(20);
    doc.text(`${APP_NAME} - JEE Main Analysis Report`, 14, 22);
    
    // Test info with exam date and shift
    doc.setFontSize(12);
    if (test?.exam_date) {
      const formattedDate = format(new Date(test.exam_date), "d MMMM yyyy");
      doc.text(`Exam Date: ${formattedDate}`, 14, 35);
      doc.text(`Shift: ${test.shift}`, 100, 35);
      doc.text(`Test: ${test?.name || "N/A"}`, 14, 42);
      doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 49);
    } else {
      doc.text(`Test: ${test?.name || "N/A"} - ${test?.shift || ""}`, 14, 35);
      doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 42);
    }

    // Score summary - use computedStats as single source of truth
    const stats = computedStats || {
      total_marks: submission.total_marks,
      total_attempted: submission.total_attempted,
      total_correct: submission.total_correct,
      total_wrong: submission.total_wrong,
      accuracy_percentage: submission.accuracy_percentage,
      negative_marks: submission.negative_marks,
      math_marks: submission.math_marks,
      physics_marks: submission.physics_marks,
      chemistry_marks: submission.chemistry_marks,
    };
    
    doc.setFontSize(16);
    doc.text(`Total Score: ${stats.total_marks}/300`, 14, 58);
    
    // Percentile
    if (percentileResult.percentile !== null) {
      doc.text(`Est. Percentile (Jan 2025): ${percentileResult.displayValue}`, 100, 58);
    }
    
    doc.setFontSize(11);
    doc.text(`Attempted: ${stats.total_attempted}`, 14, 68);
    doc.text(`Correct: ${stats.total_correct}`, 14, 75);
    doc.text(`Wrong: ${stats.total_wrong}`, 14, 82);
    doc.text(`Accuracy: ${stats.accuracy_percentage}%`, 14, 89);
    doc.text(`Negative Marks: ${stats.negative_marks}`, 14, 96);

    // Subject breakdown
    doc.text(`Mathematics: ${stats.math_marks}`, 100, 68);
    doc.text(`Physics: ${stats.physics_marks}`, 100, 75);
    doc.text(`Chemistry: ${stats.chemistry_marks}`, 100, 82);
    
    // Section breakdown
    doc.text(`Section A (MCQ): ${sectionStats.A.marks}`, 100, 89);
    doc.text(`Section B (Numerical): ${sectionStats.B.marks}`, 100, 96);

    // Mistakes table
    const wrongResponses = responses.filter((r) => r.status === "wrong");
    if (wrongResponses.length > 0) {
      doc.setFontSize(14);
      doc.text("Mistakes", 14, 110);
      
      autoTable(doc, {
        startY: 115,
        head: [["Question ID", "Your Answer", "Status", "Marks"]],
        body: wrongResponses.map((r) => [
          r.question_id,
          r.claimed_option_ids?.join(", ") || r.claimed_numeric_value?.toString() || "-",
          r.status,
          r.marks_awarded.toString(),
        ]),
      });
    }

    doc.save(`scorex-report-${id?.slice(0, 8)}.pdf`);
    
    toast({
      title: "PDF Downloaded",
      description: "Your report has been saved.",
    });
  };

  const handleDelete = async () => {
    if (!id) return;
    
    setDeleting(true);
    try {
      // Delete responses first (cascade should handle this but being explicit)
      await supabase.from("responses").delete().eq("submission_id", id);
      
      // Delete submission
      const { error } = await supabase.from("submissions").delete().eq("id", id);
      
      if (error) throw error;

      toast({
        title: "Deleted",
        description: "Your report has been deleted.",
      });
      navigate("/");
    } catch (err) {
      toast({
        title: "Error",
        description: "Failed to delete report.",
        variant: "destructive",
      });
    } finally {
      setDeleting(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "correct":
        return <CheckCircle className="w-4 h-4 text-success" />;
      case "wrong":
        return <XCircle className="w-4 h-4 text-destructive" />;
      case "unattempted":
        return <MinusCircle className="w-4 h-4 text-muted-foreground" />;
      case "cancelled":
        return <AlertTriangle className="w-4 h-4 text-warning" />;
      default:
        return null;
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, string> = {
      correct: "status-correct",
      wrong: "status-wrong",
      unattempted: "status-unattempted",
      cancelled: "status-cancelled",
    };
    return (
      <Badge variant="outline" className={variants[status] || ""}>
        {getStatusIcon(status)}
        <span className="ml-1 capitalize">{status}</span>
      </Badge>
    );
  };

  const getMostNegativeSubject = () => {
    if (subjectStats.length === 0) return null;
    const sorted = [...subjectStats].sort((a, b) => a.marks - b.marks);
    const worst = sorted[0];
    if (worst.wrong > 0) {
      return worst.subject;
    }
    return null;
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!submission) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">Result not found</p>
      </div>
    );
  }

  const worstSubject = getMostNegativeSubject();

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />

      <main className="flex-1 pt-24 pb-12 px-4">
        <div className="container mx-auto max-w-5xl">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            {/* Exam Info Banner */}
            {test && test.exam_date && (
              <div className="flex flex-wrap items-center gap-4 mb-6 p-4 rounded-lg bg-muted/50 border">
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-primary" />
                  <span className="text-sm font-medium">Exam Date:</span>
                  <span className="text-sm">{format(new Date(test.exam_date), "d MMMM yyyy")}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-primary" />
                  <span className="text-sm font-medium">Shift:</span>
                  <span className="text-sm">{test.shift}</span>
                </div>
              </div>
            )}

            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-8">
              <div>
                <h1 className="text-2xl md:text-3xl font-bold">Your Score Report</h1>
                <p className="text-muted-foreground">
                  {test ? `${test.name}` : "Score Analysis"}
                </p>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={handleCopyLink}>
                  <Copy className="w-4 h-4 mr-2" />
                  Copy Link
                </Button>
                <Button variant="outline" size="sm" onClick={handleDownloadPDF}>
                  <Download className="w-4 h-4 mr-2" />
                  Download PDF
                </Button>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="destructive" size="sm">
                      <Trash2 className="w-4 h-4 mr-2" />
                      Delete
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Delete Report?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This will permanently delete your submission and all associated data.
                        This action cannot be undone.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction onClick={handleDelete} disabled={deleting}>
                        {deleting ? "Deleting..." : "Delete"}
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </div>

            {/* Score Card + Percentile Row */}
            <div className="grid md:grid-cols-3 gap-6 mb-8">
              {/* Score Card - Uses computedStats from responses as single source of truth */}
              <div className="md:col-span-2 score-card">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
                  <div>
                    <p className="text-white/70 text-sm mb-1">Total Score</p>
                    <div className="flex items-baseline gap-2">
                      <span className="text-5xl md:text-6xl font-mono font-bold">
                        {computedStats?.total_marks ?? submission.total_marks}
                      </span>
                      <span className="text-2xl text-white/70">/300</span>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-4 md:gap-8 text-center">
                    <div>
                      <p className="text-3xl font-mono font-bold">{computedStats?.total_attempted ?? submission.total_attempted}</p>
                      <p className="text-white/70 text-sm">Attempted</p>
                    </div>
                    <div>
                      <p className="text-3xl font-mono font-bold">{computedStats?.accuracy_percentage ?? submission.accuracy_percentage}%</p>
                      <p className="text-white/70 text-sm">Accuracy</p>
                    </div>
                    <div>
                      <p className="text-3xl font-mono font-bold text-destructive/80">-{computedStats?.negative_marks ?? submission.negative_marks}</p>
                      <p className="text-white/70 text-sm">Negative</p>
                    </div>
                  </div>
                </div>
              </div>
              
              {/* Percentile Card */}
              <div className="md:col-span-1">
                <PercentileCard 
                  percentileResult={percentileResult} 
                  totalMarks={computedStats?.total_marks ?? submission.total_marks ?? 0} 
                />
              </div>
            </div>

            {/* Stats Row - Uses computedStats from responses */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
              <Card>
                <CardContent className="pt-4">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="w-5 h-5 text-success" />
                    <span className="text-2xl font-mono font-bold">{computedStats?.total_correct ?? submission.total_correct}</span>
                  </div>
                  <p className="text-sm text-muted-foreground">Correct</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4">
                  <div className="flex items-center gap-2">
                    <XCircle className="w-5 h-5 text-destructive" />
                    <span className="text-2xl font-mono font-bold">{computedStats?.total_wrong ?? submission.total_wrong}</span>
                  </div>
                  <p className="text-sm text-muted-foreground">Wrong</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4">
                  <div className="flex items-center gap-2">
                    <MinusCircle className="w-5 h-5 text-muted-foreground" />
                    <span className="text-2xl font-mono font-bold">{computedStats?.total_unattempted ?? submission.total_unattempted}</span>
                  </div>
                  <p className="text-sm text-muted-foreground">Unattempted</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4">
                  <div className="flex items-center gap-2">
                    <Target className="w-5 h-5 text-primary" />
                    <span className="text-2xl font-mono font-bold">{computedStats?.accuracy_percentage ?? submission.accuracy_percentage}%</span>
                  </div>
                  <p className="text-sm text-muted-foreground">Accuracy</p>
                </CardContent>
              </Card>
            </div>

            {/* Section-wise Breakdown */}
            <SectionBreakdownCard sectionStats={sectionStats} />

            {/* Subject Tabs with Section Filter */}
            <Card className="mb-8">
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span>Subject-wise Breakdown</span>
                  {subjectStats.length > 0 && subjectStats.length < 3 && (
                    <Badge variant="outline" className="ml-2 text-warning border-warning">
                      <AlertTriangle className="w-3 h-3 mr-1" />
                      Partial: {3 - subjectStats.length} subject(s) missing
                    </Badge>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <SubjectSectionTabs 
                  subjectSectionStats={subjectSectionStats} 
                  subjectStats={subjectStats} 
                />
              </CardContent>
            </Card>

            {/* Insights */}
            {worstSubject && (
              <Card className="mb-8 border-warning/50 bg-warning/5">
                <CardContent className="pt-6">
                  <div className="flex items-start gap-3">
                    <TrendingDown className="w-5 h-5 text-warning mt-0.5" />
                    <div>
                      <p className="font-medium">Focus Area</p>
                      <p className="text-sm text-muted-foreground">
                        Most negative marks came from <strong>{worstSubject}</strong>. 
                        Consider reviewing concepts and reducing guesswork in this subject.
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Question-wise Analysis (Owner only) */}
            {questionResults.length > 0 && (
              <div className="mb-8">
                <QuestionAnalysis questionResults={questionResults} />
              </div>
            )}
 
            {/* Mistakes Table */}
            <Card>
              <CardHeader>
                <CardTitle>Response Details</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="rounded-md border overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Question ID</TableHead>
                        <TableHead>Your Answer</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Marks</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {responses.slice(0, 75).map((r) => (
                        <TableRow key={r.id}>
                          <TableCell className="font-mono text-sm">{r.question_id}</TableCell>
                          <TableCell>
                            {r.claimed_option_ids?.join(", ") || 
                             r.claimed_numeric_value?.toString() || 
                             <span className="text-muted-foreground">-</span>}
                          </TableCell>
                          <TableCell>{getStatusBadge(r.status)}</TableCell>
                          <TableCell className="text-right font-mono">
                            <span className={
                              r.marks_awarded > 0 ? "text-success" :
                              r.marks_awarded < 0 ? "text-destructive" : ""
                            }>
                              {r.marks_awarded > 0 ? `+${r.marks_awarded}` : r.marks_awarded}
                            </span>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
                {responses.length > 75 && (
                  <p className="text-sm text-muted-foreground text-center mt-4">
                    Showing 75 of {responses.length} responses. Download PDF for complete list.
                  </p>
                )}
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default Result;
