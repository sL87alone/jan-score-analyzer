import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Plus, Pencil, Trash2, LogOut, Loader2, Upload, Calendar } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Test, MarkingRules } from "@/lib/types";
import { useToast } from "@/hooks/use-toast";
import { EXAM_DATES, SHIFTS, getExamDateLabel } from "@/lib/examDates";
import { useAdminAuth } from "@/hooks/useAdminAuth";

const defaultMarkingRules: MarkingRules = {
  mcq_single: { correct: 4, wrong: -1, unattempted: 0 },
  msq: { correct: 4, wrong: -2, unattempted: 0 },
  numerical: { correct: 4, wrong: -1, unattempted: 0 },
};

const AdminTests = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { isAuthenticated, adminId, logout, loading: authLoading } = useAdminAuth();

  const [tests, setTests] = useState<Test[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTest, setEditingTest] = useState<Test | null>(null);

  // Form state
  const [name, setName] = useState("");
  const [shift, setShift] = useState("");
  const [examDate, setExamDate] = useState("");
  const [markingRules, setMarkingRules] = useState<MarkingRules>(defaultMarkingRules);
  const [isActive, setIsActive] = useState(true);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      navigate("/admin");
    }
  }, [authLoading, isAuthenticated, navigate]);

  useEffect(() => {
    if (isAuthenticated) {
      fetchTests();
    }
  }, [isAuthenticated]);

  const fetchTests = async () => {
    const { data, error } = await supabase
      .from("tests")
      .select("*")
      .order("exam_date", { ascending: false });

    if (data) {
      setTests(data as unknown as Test[]);
    }
    if (error) {
      console.error("Error fetching tests:", error);
    }
    setLoading(false);
  };

  const handleLogout = async () => {
    await logout();
    navigate("/admin");
  };

  const resetForm = () => {
    setName("");
    setShift("");
    setExamDate("");
    setMarkingRules(defaultMarkingRules);
    setIsActive(true);
    setEditingTest(null);
  };

  const openEditDialog = (test: Test) => {
    setEditingTest(test);
    setName(test.name);
    setShift(test.shift);
    setExamDate(test.exam_date || "");
    setMarkingRules(test.marking_rules_json);
    setIsActive(test.is_active);
    setDialogOpen(true);
  };

  const handleSubmit = async () => {
    if (!name.trim() || !shift || !examDate) {
      toast({
        title: "Error",
        description: "Name, exam date, and shift are required.",
        variant: "destructive",
      });
      return;
    }

    setCreating(true);

    try {
      const examDateStr = examDate;

      if (editingTest) {
        const { error } = await supabase
          .from("tests")
          .update({
            name: name.trim(),
            shift: shift,
            exam_date: examDateStr,
            marking_rules_json: JSON.parse(JSON.stringify(markingRules)),
            is_active: isActive,
          })
          .eq("id", editingTest.id);

        if (error) throw error;

        toast({
          title: "Updated",
          description: "Test updated successfully.",
        });
      } else {
        const { error } = await supabase
          .from("tests")
          .insert({
            name: name.trim(),
            shift: shift,
            exam_date: examDateStr,
            marking_rules_json: JSON.parse(JSON.stringify(markingRules)),
            is_active: isActive,
          });

        if (error) throw error;

        toast({
          title: "Created",
          description: "Test created successfully.",
        });
      }

      setDialogOpen(false);
      resetForm();
      fetchTests();
    } catch (err: any) {
      const errorMessage = err?.message?.includes("tests_exam_date_shift_unique")
        ? "A test with this date and shift already exists."
        : err?.message?.includes("tests_shift_valid")
        ? "Shift must be 'Shift 1' or 'Shift 2'."
        : "Failed to save test.";
      
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (testId: string) => {
    if (!confirm("Delete this test? This will also delete all associated answer keys.")) {
      return;
    }

    const { error } = await supabase.from("tests").delete().eq("id", testId);

    if (error) {
      toast({
        title: "Error",
        description: "Failed to delete test.",
        variant: "destructive",
      });
    } else {
      toast({
        title: "Deleted",
        description: "Test deleted successfully.",
      });
      fetchTests();
    }
  };

  const formatExamDate = (dateStr: string | undefined) => {
    if (!dateStr) return "-";
    return getExamDateLabel(dateStr);
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted/30">
      {/* Header */}
      <header className="bg-card border-b sticky top-0 z-50">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <h1 className="text-xl font-bold">Admin Dashboard</h1>
            <Badge variant="secondary">Tests</Badge>
            {adminId && (
              <span className="text-sm text-muted-foreground">
                Logged in as: <span className="font-medium">{adminId}</span>
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => navigate("/admin/upload-key")}>
              <Upload className="w-4 h-4 mr-2" />
              Upload Keys
            </Button>
            <Button variant="ghost" size="sm" onClick={handleLogout}>
              <LogOut className="w-4 h-4 mr-2" />
              Logout
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          {/* Actions */}
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-2xl font-bold">Manage Tests</h2>
              <p className="text-muted-foreground">Create and manage exam tests/shifts</p>
            </div>
            <Dialog open={dialogOpen} onOpenChange={(open) => {
              setDialogOpen(open);
              if (!open) resetForm();
            }}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="w-4 h-4 mr-2" />
                  Create Test
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-lg">
                <DialogHeader>
                  <DialogTitle>{editingTest ? "Edit Test" : "Create New Test"}</DialogTitle>
                  <DialogDescription>
                    Configure the test details and marking rules
                  </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Test Name</Label>
                    <Input
                      id="name"
                      placeholder="JEE Main Jan 2026"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="flex items-center gap-2">
                        <Calendar className="w-4 h-4 text-muted-foreground" />
                        Exam Date
                      </Label>
                      <Select value={examDate} onValueChange={setExamDate}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select exam date" />
                        </SelectTrigger>
                        <SelectContent>
                          {EXAM_DATES.map((date) => (
                            <SelectItem key={date.value} value={date.value}>
                              {date.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="shift">Shift</Label>
                      <Select value={shift} onValueChange={setShift}>
                        <SelectTrigger id="shift">
                          <SelectValue placeholder="Select shift" />
                        </SelectTrigger>
                        <SelectContent>
                          {SHIFTS.map((s) => (
                            <SelectItem key={s} value={s}>
                              {s}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Marking Rules</Label>
                    <div className="grid grid-cols-3 gap-2 text-sm">
                      <div className="p-2 rounded bg-muted">
                        <p className="font-medium">MCQ Single</p>
                        <p className="text-muted-foreground">+{markingRules.mcq_single.correct} / {markingRules.mcq_single.wrong}</p>
                      </div>
                      <div className="p-2 rounded bg-muted">
                        <p className="font-medium">MSQ</p>
                        <p className="text-muted-foreground">+{markingRules.msq.correct} / {markingRules.msq.wrong}</p>
                      </div>
                      <div className="p-2 rounded bg-muted">
                        <p className="font-medium">Numerical</p>
                        <p className="text-muted-foreground">+{markingRules.numerical.correct} / {markingRules.numerical.wrong}</p>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <Label htmlFor="active">Active (visible to students)</Label>
                    <Switch
                      id="active"
                      checked={isActive}
                      onCheckedChange={setIsActive}
                    />
                  </div>
                </div>

                <DialogFooter>
                  <Button variant="outline" onClick={() => setDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button onClick={handleSubmit} disabled={creating}>
                    {creating ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      editingTest ? "Update" : "Create"
                    )}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>

          {/* Tests Table */}
          <Card>
            <CardContent className="p-0">
              {loading ? (
                <div className="flex items-center justify-center h-40">
                  <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                </div>
              ) : tests.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-40 text-muted-foreground">
                  <p>No tests created yet</p>
                  <p className="text-sm">Create your first test to get started</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Exam Date</TableHead>
                      <TableHead>Shift</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {tests.map((test) => (
                      <TableRow key={test.id}>
                        <TableCell className="font-medium">{test.name}</TableCell>
                        <TableCell>{formatExamDate(test.exam_date)}</TableCell>
                        <TableCell>{test.shift}</TableCell>
                        <TableCell>
                          <Badge variant={test.is_active ? "default" : "secondary"}>
                            {test.is_active ? "Active" : "Inactive"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => navigate(`/admin/upload-key?testId=${test.id}`)}
                            >
                              <Upload className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => openEditDialog(test)}
                            >
                              <Pencil className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleDelete(test.id)}
                            >
                              <Trash2 className="w-4 h-4 text-destructive" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </main>
    </div>
  );
};

export default AdminTests;
