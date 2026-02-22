import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/landing/Footer";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, FileText, ArrowRight, Calendar, Clock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

interface ReportItem {
  id: string;
  total_marks: number | null;
  created_at: string;
  test_id: string | null;
  test_name?: string;
  test_shift?: string;
  exam_date?: string;
}

const Dashboard = () => {
  const { user } = useAuth();
  const [reports, setReports] = useState<ReportItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchReports = async () => {
      if (!user) return;
      const { data } = await supabase
        .from("submissions")
        .select("id, total_marks, created_at, test_id, tests(name, shift, exam_date)")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(10);

      if (data) {
        setReports(
          data.map((d: any) => ({
            id: d.id,
            total_marks: d.total_marks,
            created_at: d.created_at,
            test_id: d.test_id,
            test_name: d.tests?.name,
            test_shift: d.tests?.shift,
            exam_date: d.tests?.exam_date,
          }))
        );
      }
      setLoading(false);
    };
    fetchReports();
  }, [user]);

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <main className="flex-1 pt-24 pb-12 px-4">
        <div className="container mx-auto max-w-3xl space-y-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
          >
            <h1 className="text-3xl font-bold mb-1">Welcome to ScoreX</h1>
            <p className="text-muted-foreground">
              {user?.email}
            </p>
          </motion.div>

          {/* Primary action */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.1 }}
          >
            <Link to="/analyze">
              <Card className="group cursor-pointer hover:border-primary/50 transition-colors">
                <CardContent className="flex items-center justify-between py-6">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                      <FileText className="w-6 h-6 text-primary" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-lg">Analyze a Response Sheet</h3>
                      <p className="text-sm text-muted-foreground">Paste URL or upload HTML</p>
                    </div>
                  </div>
                  <ArrowRight className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors" />
                </CardContent>
              </Card>
            </Link>
          </motion.div>

          {/* Reports */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.2 }}
            className="space-y-4"
          >
            <h2 className="text-xl font-semibold">My Reports</h2>
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-6 h-6 animate-spin text-primary" />
              </div>
            ) : reports.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <p className="text-muted-foreground">No reports yet. Analyze your first response sheet!</p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {reports.map((r) => (
                  <Link key={r.id} to={`/result/${r.id}`}>
                    <Card className="hover:border-primary/40 transition-colors cursor-pointer">
                      <CardContent className="flex items-center justify-between py-4">
                        <div className="space-y-1">
                          <p className="font-medium">{r.test_name || "Unknown Test"}</p>
                          <div className="flex items-center gap-3 text-xs text-muted-foreground">
                            {r.test_shift && <Badge variant="secondary" className="text-xs">{r.test_shift}</Badge>}
                            {r.exam_date && (
                              <span className="flex items-center gap-1">
                                <Calendar className="w-3 h-3" />
                                {r.exam_date}
                              </span>
                            )}
                            <span className="flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {new Date(r.created_at).toLocaleDateString()}
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="font-bold text-lg">{r.total_marks ?? "—"}</span>
                          <ArrowRight className="w-4 h-4 text-muted-foreground" />
                        </div>
                      </CardContent>
                    </Card>
                  </Link>
                ))}
              </div>
            )}
          </motion.div>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default Dashboard;
