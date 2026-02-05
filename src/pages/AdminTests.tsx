import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
 import { Plus, Pencil, Trash2, LogOut, Loader2, Upload, Calendar, Database, FileText, Key, RefreshCw, Bug, RotateCcw, AlertTriangle } from "lucide-react";
import { Test, MarkingRules } from "@/lib/types";
import { useToast } from "@/hooks/use-toast";
import { EXAM_DATES, SHIFTS, getExamDateLabel } from "@/lib/examDates";
import { useAdminAuth } from "@/hooks/useAdminAuth";
import { UpdateKeysModal } from "@/components/admin/UpdateKeysModal";
 import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

const defaultMarkingRules: MarkingRules = {
  mcq_single: { correct: 4, wrong: -1, unattempted: 0 },
  msq: { correct: 4, wrong: -2, unattempted: 0 },
  numerical: { correct: 4, wrong: -1, unattempted: 0 },
};

// Jan 2026 exam dates to seed
const JAN_2026_DATES = [
  "2026-01-21",
  "2026-01-22",
  "2026-01-23",
  "2026-01-24",
  "2026-01-28",
];

interface TestWithKeyCount extends Test {
  key_count?: number;
}

const AdminTests = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { isAuthenticated, adminId, logout, loading: authLoading } = useAdminAuth();

  const [tests, setTests] = useState<TestWithKeyCount[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [creating, setCreating] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTest, setEditingTest] = useState<Test | null>(null);
  const [showDebug, setShowDebug] = useState(false);
  const [debugInfo, setDebugInfo] = useState<{ testId: string; date: string; shift: string; keyCount: number }[]>([]);
 const [fetchError, setFetchError] = useState<string | null>(null);
  
  // Update Keys Modal state
  const [updateModalOpen, setUpdateModalOpen] = useState(false);
  const [selectedTestForUpdate, setSelectedTestForUpdate] = useState<TestWithKeyCount | null>(null);

  // Form state
  const [name, setName] = useState("");
  const [shift, setShift] = useState("");
  const [examDate, setExamDate] = useState("");
  const [markingRules, setMarkingRules] = useState<MarkingRules>(defaultMarkingRules);
  const [isActive, setIsActive] = useState(true);

  // Silent auto-seed via edge function
  const autoSeedTests = async (token: string) => {
    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-seed-tests`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
        }
      );

      if (!response.ok) {
        const result = await response.json();
        console.error("Auto-seed failed:", result.error);
      } else {
        const result = await response.json();
        console.log("Auto-seeded:", result);
      }
    } catch (err) {
      console.error("Auto-seed error:", err);
    }
  };

   // Helper to get session token
   const getSessionToken = (): string | null => {
     const stored = localStorage.getItem("admin_session");
     if (!stored) return null;
     try {
       const parsed = JSON.parse(stored);
       return parsed.sessionToken || null;
     } catch {
       return null;
     }
   };
 
   const fetchTestsWithKeyCounts = useCallback(async (showRefreshToast = false) => {
    if (showRefreshToast) {
      setRefreshing(true);
    }
    
     setFetchError(null);
    console.log("Fetching tests with key counts...");
     
     const token = getSessionToken();
     if (!token) {
       setFetchError("Not authenticated. Please log in again.");
      setLoading(false);
      setRefreshing(false);
      return;
    }
     
     try {
       const response = await fetch(
         `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-fetch-tests`,
         {
           method: "GET",
           headers: {
             "Content-Type": "application/json",
             Authorization: `Bearer ${token}`,
             apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
           },
         }
       );
 
       const result = await response.json();
 
       if (!response.ok) {
         const errorMsg = result.error || `Failed to fetch tests (${response.status})`;
         console.error("Error fetching tests:", errorMsg);
         setFetchError(errorMsg);
         toast({
           title: "Fetch Failed",
           description: errorMsg,
           variant: "destructive",
         });
         setLoading(false);
         setRefreshing(false);
         return;
       }
 
       const { tests: testsData, keyCounts } = result;
 
       if (!testsData || testsData.length === 0) {
         setTests([]);
         setLoading(false);
         setRefreshing(false);
         return;
       }
 
       // Merge counts with tests
       const testsWithCounts: TestWithKeyCount[] = testsData.map((test: any) => ({
         ...(test as Test),
         key_count: keyCounts[test.id] || 0,
       }));
 
       // Update debug info
       const debugData = testsWithCounts.map(t => ({
         testId: t.id,
         date: t.exam_date || "unknown",
         shift: t.shift,
         keyCount: t.key_count || 0,
       }));
       setDebugInfo(debugData);
 
       console.log("Tests with key counts:", debugData);
 
       setTests(testsWithCounts);
       setLoading(false);
       setRefreshing(false);
       
       if (showRefreshToast) {
         const totalKeys = testsWithCounts.reduce((sum, t) => sum + (t.key_count || 0), 0);
         toast({
           title: "Data refreshed",
           description: `Found ${testsWithCounts.length} tests with ${totalKeys} total answer keys`,
         });
       }
     } catch (err) {
       console.error("Fetch error:", err);
       const errorMsg = err instanceof Error ? err.message : "Network error fetching tests";
       setFetchError(errorMsg);
       toast({
         title: "Fetch Failed",
         description: errorMsg,
         variant: "destructive",
       });
       setLoading(false);
       setRefreshing(false);
    }
  }, [toast]);

  // Initialize tests - auto-seed if empty, then fetch
  const initializeTests = useCallback(async () => {
    setLoading(true);
     setFetchError(null);
    
     const token = getSessionToken();
     if (!token) {
       setFetchError("Not authenticated. Please log in again.");
       setLoading(false);  
      return;
    }
     
     // Auto-seed first (this handles the empty check internally)
     await autoSeedTests(token);
     
     // Then fetch all tests with key counts
    await fetchTestsWithKeyCounts();
  }, [fetchTestsWithKeyCounts]);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      navigate("/admin");
    }
  }, [authLoading, isAuthenticated, navigate]);

  useEffect(() => {
    if (isAuthenticated) {
      initializeTests();
    }
  }, [isAuthenticated, initializeTests]);

  // Check for refresh signal from upload page
  useEffect(() => {
    const handleStorageChange = () => {
      const refreshNeeded = localStorage.getItem("tests_refresh_needed");
      if (refreshNeeded) {
        console.log("Refresh signal detected, refetching tests...");
        localStorage.removeItem("tests_refresh_needed");
        fetchTestsWithKeyCounts(false);
      }
    };

    // Check on mount
    handleStorageChange();

    // Listen for storage events (from other tabs)
    window.addEventListener("storage", handleStorageChange);
    
    // Also check on focus (for same-tab navigation) 
    window.addEventListener("focus", handleStorageChange);
    
    // Also listen for visibilitychange for more reliable detection
    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        handleStorageChange();
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);
    
    return () => {
      window.removeEventListener("storage", handleStorageChange);
      window.removeEventListener("focus", handleStorageChange);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [fetchTestsWithKeyCounts]);

  const handleSeedTests = async () => {
    const token = localStorage.getItem("admin_session");
    if (!token) {
      toast({
        title: "Error",
        description: "Not authenticated. Please log in again.",
        variant: "destructive",
      });
      return;
    }

    let sessionToken = "";
    try {
      const parsed = JSON.parse(token);
      sessionToken = parsed.sessionToken;
    } catch {
      toast({
        title: "Error",
        description: "Invalid session. Please log in again.",
        variant: "destructive",
      });
      return;
    }

    setSeeding(true);

    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-seed-tests`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${sessionToken}`,
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
        }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Failed to seed tests");
      }

      toast({
        title: "Tests Seeded",
        description: `Created ${result.created} tests, ${result.skipped} already existed.`,
      });

      await fetchTestsWithKeyCounts();
    } catch (err) {
      console.error("Seeding error:", err);
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "Failed to seed tests.",
        variant: "destructive",
      });
    } finally {
      setSeeding(false);
    }
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
      if (editingTest) {
         const token = getSessionToken();
         if (!token) throw new Error("Not authenticated");
         
         const response = await fetch(
           `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-manage-tests?action=update`,
           {
             method: "POST",
             headers: {
               "Content-Type": "application/json",
               Authorization: `Bearer ${token}`,
               apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
             },
             body: JSON.stringify({
               id: editingTest.id,
               name: name.trim(),
               shift: shift,
               exam_date: examDate,
               marking_rules_json: markingRules,
               is_active: isActive,
             }),
           }
         );
 
         const result = await response.json();
         if (!response.ok) throw new Error(result.error || "Failed to update test");

        toast({
          title: "Updated",
          description: "Test updated successfully.",
        });
      } else {
         const token = getSessionToken();
         if (!token) throw new Error("Not authenticated");
         
         const response = await fetch(
           `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-manage-tests?action=create`,
           {
             method: "POST",
             headers: {
               "Content-Type": "application/json",
               Authorization: `Bearer ${token}`,
               apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
             },
             body: JSON.stringify({
               name: name.trim(),
               shift: shift,
               exam_date: examDate,
               marking_rules_json: markingRules,
               is_active: isActive,
             }),
           }
         );
 
         const result = await response.json();
         if (!response.ok) throw new Error(result.error || "Failed to create test");

        toast({
          title: "Created",
          description: "Test created successfully.",
        });
      }

      setDialogOpen(false);
      resetForm();
      fetchTestsWithKeyCounts();
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

     const token = getSessionToken();
     if (!token) {
      toast({
        title: "Error",
         description: "Not authenticated. Please log in again.",
        variant: "destructive",
      });
       return;
     }
 
     try {
       const response = await fetch(
         `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-manage-tests?action=delete`,
         {
           method: "POST",
           headers: {
             "Content-Type": "application/json",
             Authorization: `Bearer ${token}`,
             apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
           },
           body: JSON.stringify({ id: testId }),
         }
       );
 
       const result = await response.json();
       if (!response.ok) throw new Error(result.error || "Failed to delete test");
 
       toast({
         title: "Deleted",
         description: "Test deleted successfully.",
       });
       fetchTestsWithKeyCounts();
     } catch (err) {
       toast({
         title: "Error",
         description: err instanceof Error ? err.message : "Failed to delete test.",
         variant: "destructive",
       });
    }
  };

  const formatExamDate = (dateStr: string | undefined) => {
    if (!dateStr) return "-";
    return getExamDateLabel(dateStr);
  };

  const getKeyCountBadge = (count: number) => {
    if (count >= 75) {
      return <Badge variant="default">{count} keys</Badge>;
    } else if (count > 0) {
      return <Badge variant="secondary">{count} keys</Badge>;
    } else {
      return <Badge variant="destructive">No keys</Badge>;
    }
  };

  const getKeyStatusBadge = (count: number) => {
    if (count >= 75) {
      return <Badge variant="outline" className="border-primary text-primary">Uploaded</Badge>;
    } else if (count > 0) {
      return <Badge variant="outline" className="border-muted-foreground">Partial</Badge>;
    } else {
      return <Badge variant="outline" className="border-destructive text-destructive">Not uploaded</Badge>;
    }
  };

  // Group tests by exam date for better display
  const groupedTests = tests.reduce((acc, test) => {
    const date = test.exam_date || "Unknown";
    if (!acc[date]) acc[date] = [];
    acc[date].push(test);
    return acc;
  }, {} as Record<string, TestWithKeyCount[]>);

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
            <Badge variant="outline" className="font-mono">
              Admin: {adminId || "—"}
            </Badge>
          </div>
          <div className="flex items-center gap-2">
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => navigate("/admin/tests")}
              className="font-medium"
            >
              <FileText className="w-4 h-4 mr-2" />
              Tests
            </Button>
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => navigate("/admin/upload-key")}
            >
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
            <div className="flex items-center gap-2">
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => fetchTestsWithKeyCounts(true)}
                disabled={loading || refreshing}
              >
                {refreshing ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                <span className="ml-2">Refresh</span>
              </Button>
              <Button 
                variant="ghost" 
                size="sm"
                onClick={() => setShowDebug(!showDebug)}
              >
                <Bug className="w-4 h-4" />
                <span className="ml-2">Debug</span>
              </Button>
              <Button 
                variant="outline" 
                onClick={handleSeedTests}
                disabled={seeding}
              >
                {seeding ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Seeding...
                  </>
                ) : (
                  <>
                    <Database className="w-4 h-4 mr-2" />
                    Seed Jan 2026 Tests
                  </>
                )}
              </Button>
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
          </div>

          {/* Debug Panel */}
          {showDebug && (
            <Card className="mb-6 border-dashed border-muted-foreground/50">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Bug className="w-4 h-4" />
                  Debug Info: Key Counts from Database
                </CardTitle>
                <CardDescription>
                  Raw data showing test_id → key_count mapping
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="bg-muted rounded-md p-3 font-mono text-xs overflow-auto max-h-40">
                  {debugInfo.length === 0 ? (
                    <p className="text-muted-foreground">No data loaded yet. Click Refresh.</p>
                  ) : (
                    <pre>{JSON.stringify(debugInfo, null, 2)}</pre>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Tests Table */}
          <Card>
            <CardContent className="p-0">
               {fetchError ? (
                 <div className="p-6">
                   <Alert variant="destructive">
                     <AlertTriangle className="h-4 w-4" />
                     <AlertTitle>Failed to fetch tests</AlertTitle>
                     <AlertDescription className="mt-2">
                       {fetchError}
                       <div className="mt-4">
                         <Button 
                           variant="outline" 
                           size="sm"
                           onClick={() => fetchTestsWithKeyCounts(true)}
                         >
                           <RefreshCw className="w-4 h-4 mr-2" />
                           Retry
                         </Button>
                       </div>
                     </AlertDescription>
                   </Alert>
                 </div>
               ) : loading ? (
                <div className="flex items-center justify-center h-40">
                  <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                </div>
              ) : tests.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
                    <Key className="w-8 h-8 text-muted-foreground" />
                  </div>
                  <h3 className="text-lg font-semibold mb-2">No tests created yet</h3>
                  <p className="text-muted-foreground mb-6 max-w-md">
                    Get started by seeding the January 2026 exam tests or create a custom test.
                  </p>
                  <div className="flex items-center gap-3">
                    <Button onClick={handleSeedTests} disabled={seeding}>
                      {seeding ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Seeding...
                        </>
                      ) : (
                        <>
                          <Database className="w-4 h-4 mr-2" />
                          Seed Jan 2026 Tests
                        </>
                      )}
                    </Button>
                    <Button variant="outline" onClick={() => setDialogOpen(true)}>
                      <Plus className="w-4 h-4 mr-2" />
                      Create Test
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="divide-y">
                  {Object.entries(groupedTests)
                    .sort(([a], [b]) => a.localeCompare(b))
                    .map(([date, dateTests]) => (
                    <div key={date}>
                      {/* Date Header */}
                      <div className="bg-muted/50 px-4 py-3 border-b">
                        <div className="flex items-center gap-2">
                          <Calendar className="w-4 h-4 text-muted-foreground" />
                          <span className="font-semibold">{formatExamDate(date)}</span>
                          <Badge variant="outline" className="ml-2">
                            {dateTests.length} shifts
                          </Badge>
                        </div>
                      </div>
                      {/* Shifts for this date */}
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-[120px]">Shift</TableHead>
                            <TableHead className="w-[120px]">Key Count</TableHead>
                            <TableHead className="w-[140px]">Key Status</TableHead>
                            <TableHead className="w-[100px]">Active</TableHead>
                            <TableHead>Last Updated</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {dateTests
                            .sort((a, b) => a.shift.localeCompare(b.shift))
                            .map((test) => (
                            <TableRow key={test.id}>
                              <TableCell className="font-medium">
                                {test.shift}
                              </TableCell>
                              <TableCell>
                                {getKeyCountBadge(test.key_count || 0)}
                              </TableCell>
                              <TableCell>
                                {getKeyStatusBadge(test.key_count || 0)}
                              </TableCell>
                              <TableCell>
                                <Badge variant={test.is_active ? "default" : "secondary"}>
                                  {test.is_active ? "Active" : "Inactive"}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-muted-foreground text-sm">
                                {new Date(test.updated_at).toLocaleDateString()}
                              </TableCell>
                              <TableCell className="text-right">
                                <div className="flex justify-end gap-1">
                                  {/* Show Update Keys button prominently if keys exist */}
                                  {(test.key_count || 0) >= 75 ? (
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={() => {
                                        setSelectedTestForUpdate(test);
                                        setUpdateModalOpen(true);
                                      }}
                                      title="Update Keys"
                                      className="gap-1"
                                    >
                                      <RotateCcw className="w-3 h-3" />
                                      Update
                                    </Button>
                                  ) : (
                                    <Button
                                      variant="default"
                                      size="sm"
                                      onClick={() => navigate(`/admin/upload-key?testId=${test.id}`)}
                                      title="Upload Keys"
                                      className="gap-1"
                                    >
                                      <Upload className="w-3 h-3" />
                                      Upload
                                    </Button>
                                  )}
                                  {/* Update button for partial uploads */}
                                  {(test.key_count || 0) > 0 && (test.key_count || 0) < 75 && (
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      onClick={() => {
                                        setSelectedTestForUpdate(test);
                                        setUpdateModalOpen(true);
                                      }}
                                      title="Update Keys"
                                    >
                                      <RotateCcw className="w-4 h-4" />
                                    </Button>
                                  )}
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => openEditDialog(test)}
                                    title="Edit"
                                  >
                                    <Pencil className="w-4 h-4" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => handleDelete(test.id)}
                                    title="Delete"
                                  >
                                    <Trash2 className="w-4 h-4 text-destructive" />
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </main>

      {/* Update Keys Modal */}
      <UpdateKeysModal
        open={updateModalOpen}
        onOpenChange={setUpdateModalOpen}
        test={selectedTestForUpdate ? {
          id: selectedTestForUpdate.id,
          name: selectedTestForUpdate.name,
          exam_date: selectedTestForUpdate.exam_date || "",
          shift: selectedTestForUpdate.shift,
          key_count: selectedTestForUpdate.key_count || 0,
          updated_at: selectedTestForUpdate.updated_at,
        } : null}
        onSuccess={() => {
          fetchTestsWithKeyCounts(false);
        }}
      />
    </div>
  );
};

export default AdminTests;
