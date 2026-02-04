import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/landing/Footer";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  TrendingUp,
  TrendingDown,
  Loader2,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Submission, Response as ResponseType, Test, SubjectStats } from "@/lib/types";
import { useToast } from "@/hooks/use-toast";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

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

      // Fetch test info
      if (subData.test_id) {
        const { data: testData } = await supabase
          .from("tests")
          .select("*")
          .eq("id", subData.test_id)
          .single();

        if (testData) {
          setTest(testData as unknown as Test);
        }
      }

      // Fetch responses
      const { data: respData } = await supabase
        .from("responses")
        .select("*")
        .eq("submission_id", id)
        .order("question_id");

      if (respData) {
        setResponses(respData as unknown as ResponseType[]);

        // Calculate subject stats from responses
        const stats: Record<string, SubjectStats> = {};
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
            };
          }
          stats[subject].marks += r.marks_awarded || 0;
          if (r.status === "correct") {
            stats[subject].correct++;
            stats[subject].attempted++;
          } else if (r.status === "wrong") {
            stats[subject].wrong++;
            stats[subject].attempted++;
          } else if (r.status === "unattempted") {
            stats[subject].unattempted++;
          }
        });

        Object.values(stats).forEach((s) => {
          s.accuracy = s.attempted > 0 ? Math.round((s.correct / s.attempted) * 100) : 0;
        });

        setSubjectStats(Object.values(stats));
      }
    } catch (err) {
      console.error("Error fetching results:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleCopyLink = async () => {
    const link = window.location.href;
    await navigator.clipboard.writeText(link);
    toast({
      title: "Link Copied!",
      description: "Share link has been copied to clipboard.",
    });
  };

  const handleDownloadPDF = () => {
    if (!submission) return;

    const doc = new jsPDF();
    
    // Title
    doc.setFontSize(20);
    doc.text("JanScore - JEE Main Analysis Report", 14, 22);
    
    // Test info
    doc.setFontSize(12);
    doc.text(`Test: ${test?.name || "N/A"} - ${test?.shift || ""}`, 14, 35);
    doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 42);

    // Score summary
    doc.setFontSize(16);
    doc.text(`Total Score: ${submission.total_marks}`, 14, 55);
    
    doc.setFontSize(11);
    doc.text(`Attempted: ${submission.total_attempted}`, 14, 65);
    doc.text(`Correct: ${submission.total_correct}`, 14, 72);
    doc.text(`Wrong: ${submission.total_wrong}`, 14, 79);
    doc.text(`Accuracy: ${submission.accuracy_percentage}%`, 14, 86);
    doc.text(`Negative Marks: ${submission.negative_marks}`, 14, 93);

    // Subject breakdown
    doc.text(`Mathematics: ${submission.math_marks}`, 100, 65);
    doc.text(`Physics: ${submission.physics_marks}`, 100, 72);
    doc.text(`Chemistry: ${submission.chemistry_marks}`, 100, 79);

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

    doc.save(`janscore-report-${id?.slice(0, 8)}.pdf`);
    
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
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-8">
              <div>
                <h1 className="text-2xl md:text-3xl font-bold">Your Score Report</h1>
                <p className="text-muted-foreground">
                  {test ? `${test.name} – ${test.shift}` : "Score Analysis"}
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

            {/* Score Card */}
            <div className="score-card mb-8">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
                <div>
                  <p className="text-white/70 text-sm mb-1">Total Score</p>
                  <div className="flex items-baseline gap-2">
                    <span className="text-5xl md:text-6xl font-mono font-bold">
                      {submission.total_marks}
                    </span>
                    <span className="text-2xl text-white/70">/300</span>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-4 md:gap-8 text-center">
                  <div>
                    <p className="text-3xl font-mono font-bold">{submission.total_attempted}</p>
                    <p className="text-white/70 text-sm">Attempted</p>
                  </div>
                  <div>
                    <p className="text-3xl font-mono font-bold">{submission.accuracy_percentage}%</p>
                    <p className="text-white/70 text-sm">Accuracy</p>
                  </div>
                  <div>
                    <p className="text-3xl font-mono font-bold text-red-300">-{submission.negative_marks}</p>
                    <p className="text-white/70 text-sm">Negative</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Stats Row */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
              <Card>
                <CardContent className="pt-4">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="w-5 h-5 text-success" />
                    <span className="text-2xl font-mono font-bold">{submission.total_correct}</span>
                  </div>
                  <p className="text-sm text-muted-foreground">Correct</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4">
                  <div className="flex items-center gap-2">
                    <XCircle className="w-5 h-5 text-destructive" />
                    <span className="text-2xl font-mono font-bold">{submission.total_wrong}</span>
                  </div>
                  <p className="text-sm text-muted-foreground">Wrong</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4">
                  <div className="flex items-center gap-2">
                    <MinusCircle className="w-5 h-5 text-muted-foreground" />
                    <span className="text-2xl font-mono font-bold">{submission.total_unattempted}</span>
                  </div>
                  <p className="text-sm text-muted-foreground">Unattempted</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4">
                  <div className="flex items-center gap-2">
                    <Target className="w-5 h-5 text-primary" />
                    <span className="text-2xl font-mono font-bold">{submission.accuracy_percentage}%</span>
                  </div>
                  <p className="text-sm text-muted-foreground">Accuracy</p>
                </CardContent>
              </Card>
            </div>

            {/* Subject Tabs */}
            <Card className="mb-8">
              <CardHeader>
                <CardTitle>Subject-wise Breakdown</CardTitle>
              </CardHeader>
              <CardContent>
                <Tabs defaultValue="Mathematics">
                  <TabsList className="grid w-full grid-cols-3">
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

                  {["Mathematics", "Physics", "Chemistry"].map((subject) => {
                    const stats = subjectStats.find((s) => s.subject === subject) || {
                      marks: subject === "Mathematics" ? submission.math_marks :
                             subject === "Physics" ? submission.physics_marks :
                             submission.chemistry_marks,
                      attempted: 0,
                      correct: 0,
                      wrong: 0,
                      unattempted: 0,
                      accuracy: 0,
                    };

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
