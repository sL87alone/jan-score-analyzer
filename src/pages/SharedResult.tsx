import { useState, useEffect, useMemo } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { motion } from "framer-motion";
import { format } from "date-fns";
import { Helmet } from "react-helmet-async";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/landing/Footer";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  CheckCircle,
  XCircle,
  MinusCircle,
  Target,
  Loader2,
  Calendar,
  Clock,
  Share2,
  ExternalLink,
  Info,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { PercentileCard } from "@/components/report/PercentileCard";
import { estimatePercentile, PercentileResult } from "@/lib/percentile";

// Type for the public report data returned by RPC
interface PublicReportData {
  id: string;
  user_id?: string; // For ownership check
  test_name: string | null;
  test_shift: string | null;
  exam_date: string | null;
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
  created_at: string;
}

const SharedResult = () => {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();

  const [report, setReport] = useState<PublicReportData | null>(null);
  const [ownerId, setOwnerId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [percentileResult, setPercentileResult] = useState<PercentileResult>({
    percentile: null,
    displayValue: "N/A",
    mapped2025Shift: null,
    mapped2025ShiftDisplay: null,
    isBelow: false,
    isAbove: false,
  });

  useEffect(() => {
    if (token) {
      fetchPublicReport();
    }
  }, [token]);

  const fetchPublicReport = async () => {
    try {
      // Use the secure RPC function to get public report
      const { data, error } = await supabase.rpc("get_public_report", {
        p_share_token: token,
      });

      if (error) {
        console.error("RPC error:", error);
        toast({
          title: "Error",
          description: "This shared link is invalid or has been removed.",
          variant: "destructive",
        });
        navigate("/");
        return;
      }

      if (!data || (Array.isArray(data) && data.length === 0)) {
        toast({
          title: "Not Found",
          description: "This shared report does not exist or sharing has been disabled.",
          variant: "destructive",
        });
        navigate("/");
        return;
      }

      // RPC returns single row, handle both array and object response
      const reportData = Array.isArray(data) ? data[0] : data;
      setReport(reportData as PublicReportData);
      
      // Fetch owner ID separately for ownership check (not exposed via RPC for security)
      // We'll look up the submission directly since user can only see their own
      if (reportData.id) {
        const { data: subData } = await supabase
          .from("submissions")
          .select("user_id")
          .eq("id", reportData.id)
          .maybeSingle();
        if (subData?.user_id) {
          setOwnerId(subData.user_id);
        }
      }

      // Calculate percentile if exam data available
      if (reportData.exam_date && reportData.test_shift) {
        const percentile = estimatePercentile(
          reportData.total_marks,
          reportData.exam_date,
          reportData.test_shift
        );
        setPercentileResult(percentile);
      }
    } catch (err) {
      console.error("Error fetching public report:", err);
      toast({
        title: "Error",
        description: "Failed to load the shared report.",
        variant: "destructive",
      });
      navigate("/");
    } finally {
      setLoading(false);
    }
  };

  // Check if current user is the owner
  const isOwner = useMemo(() => {
    return user && ownerId && user.id === ownerId;
  }, [user, ownerId]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!report) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">Report not found</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Helmet>
        <meta name="robots" content="noindex, nofollow" />
        <title>Shared Score Report | ScoreX</title>
      </Helmet>
      <Navbar />

      <main className="flex-1 pt-24 pb-12 px-4">
        <div className="container mx-auto max-w-5xl">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            {/* Shared indicator */}
            {isOwner ? (
              <div className="flex items-center justify-between gap-4 mb-4 p-3 rounded-lg bg-primary/10 border border-primary/20">
                <div className="flex items-center gap-2 text-primary">
                  <Info className="w-4 h-4" />
                  <span className="text-sm font-medium">You're viewing the shared version of your report.</span>
                </div>
                <Button asChild size="sm">
                  <Link to={`/result/${report.id}`}>
                    <ExternalLink className="w-4 h-4 mr-2" />
                    Open Full Report
                  </Link>
                </Button>
              </div>
            ) : (
              <div className="flex items-center gap-2 mb-4 text-muted-foreground">
                <Share2 className="w-4 h-4" />
                <span className="text-sm">Shared Report (View Only)</span>
              </div>
            )}

            {/* Exam Info Banner */}
            {report.exam_date && (
              <div className="flex flex-wrap items-center gap-4 mb-6 p-4 rounded-lg bg-muted/50 border">
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-primary" />
                  <span className="text-sm font-medium">Exam Date:</span>
                  <span className="text-sm">{format(new Date(report.exam_date), "d MMMM yyyy")}</span>
                </div>
                {report.test_shift && (
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-primary" />
                    <span className="text-sm font-medium">Shift:</span>
                    <span className="text-sm">{report.test_shift}</span>
                  </div>
                )}
              </div>
            )}

            {/* Header */}
            <div className="mb-8">
              <h1 className="text-2xl md:text-3xl font-bold">Score Report</h1>
              <p className="text-muted-foreground">
                {report.test_name || "JEE Main Analysis"}
              </p>
            </div>

            {/* Score Card + Percentile Row */}
            <div className="grid md:grid-cols-3 gap-6 mb-8">
              <div className="md:col-span-2 score-card">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
                  <div>
                    <p className="text-white/70 text-sm mb-1">Total Score</p>
                    <div className="flex items-baseline gap-2">
                      <span className="text-5xl md:text-6xl font-mono font-bold">
                        {report.total_marks}
                      </span>
                      <span className="text-2xl text-white/70">/300</span>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-4 md:gap-8 text-center">
                    <div>
                      <p className="text-3xl font-mono font-bold">{report.total_attempted}</p>
                      <p className="text-white/70 text-sm">Attempted</p>
                    </div>
                    <div>
                      <p className="text-3xl font-mono font-bold">{report.accuracy_percentage}%</p>
                      <p className="text-white/70 text-sm">Accuracy</p>
                    </div>
                    <div>
                      <p className="text-3xl font-mono font-bold text-destructive/80">-{report.negative_marks}</p>
                      <p className="text-white/70 text-sm">Negative</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Percentile Card */}
              <div className="md:col-span-1">
                <PercentileCard
                  percentileResult={percentileResult}
                  totalMarks={report.total_marks}
                />
              </div>
            </div>

            {/* Stats Row */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
              <Card>
                <CardContent className="pt-4">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="w-5 h-5 text-success" />
                    <span className="text-2xl font-mono font-bold">{report.total_correct}</span>
                  </div>
                  <p className="text-sm text-muted-foreground">Correct</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4">
                  <div className="flex items-center gap-2">
                    <XCircle className="w-5 h-5 text-destructive" />
                    <span className="text-2xl font-mono font-bold">{report.total_wrong}</span>
                  </div>
                  <p className="text-sm text-muted-foreground">Wrong</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4">
                  <div className="flex items-center gap-2">
                    <MinusCircle className="w-5 h-5 text-muted-foreground" />
                    <span className="text-2xl font-mono font-bold">{report.total_unattempted}</span>
                  </div>
                  <p className="text-sm text-muted-foreground">Unattempted</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4">
                  <div className="flex items-center gap-2">
                    <Target className="w-5 h-5 text-primary" />
                    <span className="text-2xl font-mono font-bold">{report.accuracy_percentage}%</span>
                  </div>
                  <p className="text-sm text-muted-foreground">Accuracy</p>
                </CardContent>
              </Card>
            </div>

            {/* Subject Breakdown */}
            <Card className="mb-8">
              <CardHeader>
                <CardTitle>Subject-wise Breakdown</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-3 gap-4 text-center">
                  <div className="p-4 rounded-lg bg-muted/50">
                    <p className="text-2xl font-mono font-bold">{report.math_marks}</p>
                    <p className="text-sm text-muted-foreground">Mathematics</p>
                  </div>
                  <div className="p-4 rounded-lg bg-muted/50">
                    <p className="text-2xl font-mono font-bold">{report.physics_marks}</p>
                    <p className="text-sm text-muted-foreground">Physics</p>
                  </div>
                  <div className="p-4 rounded-lg bg-muted/50">
                    <p className="text-2xl font-mono font-bold">{report.chemistry_marks}</p>
                    <p className="text-sm text-muted-foreground">Chemistry</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Note about limited view */}
            <div className="text-center text-sm text-muted-foreground">
              <p>This is a shared view with limited information.</p>
              <p>Question-level details are only visible to the report owner.</p>
            </div>
          </motion.div>
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default SharedResult;
