import React, { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ArrowLeft, Upload, Loader2, AlertCircle, CheckCircle, FileText, LogOut, Calendar, Clock, Zap } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Test } from "@/lib/types";
import { useToast } from "@/hooks/use-toast";
import { EXAM_DATES, SHIFTS, getExamDateLabel } from "@/lib/examDates";
import { BUILT_IN_KEYS, getBuiltInKeyStats } from "@/lib/builtInKeys";
import { normalizeShift, normalizeExamDate } from "@/lib/normalize";

interface ParsedKey {
  question_id: string;
  subject: string;
  question_type: string;
  correct_option_ids: string[] | null;
  correct_numeric_value: number | null;
  numeric_tolerance: number;
  is_cancelled: boolean;
  is_bonus: boolean;
}

interface ImportResult {
  testId: string;
  keyCount: number;
  mathCount: number;
  physicsCount: number;
  chemistryCount: number;
}

const AdminUploadKey = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { toast } = useToast();

  const [tests, setTests] = useState<Test[]>([]);
  
  // Date and shift selection (using hardcoded dates)
  const [selectedDate, setSelectedDate] = useState("");
  const [availableShifts, setAvailableShifts] = useState<string[]>([]);
  const [selectedShift, setSelectedShift] = useState("");
  const [selectedTestId, setSelectedTestId] = useState(searchParams.get("testId") || "");
  
  const [csvContent, setCsvContent] = useState("");
  const [loading, setLoading] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [parsedKeys, setParsedKeys] = useState<ParsedKey[]>([]);
  const [error, setError] = useState("");
  const [dateError, setDateError] = useState("");
  const [shiftError, setShiftError] = useState("");
  const [quickImporting, setQuickImporting] = useState(false);
  const [lastImportResult, setLastImportResult] = useState<ImportResult | null>(null);
  useEffect(() => {
    checkAuth();
    fetchTests();
  }, []);

  // If testId is provided in URL, set the date and shift from that test
  useEffect(() => {
    const testIdFromUrl = searchParams.get("testId");
    if (testIdFromUrl && tests.length > 0) {
      const test = tests.find(t => t.id === testIdFromUrl);
      if (test && test.exam_date) {
        setSelectedDate(test.exam_date);
        setSelectedShift(test.shift);
        setSelectedTestId(test.id);
      }
    }
  }, [searchParams, tests]);

  const checkAuth = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      navigate("/admin");
      return;
    }

    const { data: roles } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "admin")
      .maybeSingle();

    if (!roles) {
      navigate("/admin");
    }
  };

  const fetchTests = async () => {
    const { data } = await supabase
      .from("tests")
      .select("*")
      .not("exam_date", "is", null)
      .order("exam_date", { ascending: false });

    if (data) {
      setTests(data as unknown as Test[]);
    }
  };

  // When date changes, determine available shifts from DB or show both
  useEffect(() => {
    if (selectedDate) {
      const shiftsForDate = tests
        .filter(t => t.exam_date === selectedDate)
        .map(t => t.shift);
      const uniqueShifts = [...new Set(shiftsForDate)];
      
      // If tests exist for this date, show only available shifts; otherwise show both
      setAvailableShifts(uniqueShifts.length > 0 ? uniqueShifts : [...SHIFTS]);
      
      // Don't reset shift if it's valid for the new date
      if (!shiftsForDate.includes(selectedShift)) {
        setSelectedShift("");
        setSelectedTestId("");
      }
      setShiftError("");
    } else {
      setAvailableShifts([]);
      setSelectedShift("");
      setSelectedTestId("");
    }
  }, [selectedDate, tests]);

  // When shift changes, resolve test_id
  useEffect(() => {
    if (selectedDate && selectedShift) {
      const matchingTest = tests.find(
        t => t.exam_date === selectedDate && t.shift === selectedShift
      );
      if (matchingTest) {
        setSelectedTestId(matchingTest.id);
      } else {
        setSelectedTestId("");
      }
    } else {
      setSelectedTestId("");
    }
  }, [selectedDate, selectedShift, tests]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/admin");
  };

  const handleQuickImport = async (keySet: typeof BUILT_IN_KEYS[0]) => {
    setQuickImporting(true);
    setError("");
    setLastImportResult(null);

    // Normalize values
    const normalizedDate = normalizeExamDate(keySet.exam_date);
    const normalizedShift = normalizeShift(keySet.shift);

    if (!normalizedDate || !normalizedShift) {
      setError(`Invalid date/shift in built-in key: ${keySet.exam_date} / ${keySet.shift}`);
      setQuickImporting(false);
      return;
    }

    console.log("Quick import starting:", { normalizedDate, normalizedShift });

    try {
      // 1. Upsert the test
      const { data: existingTest } = await supabase
        .from("tests")
        .select("id")
        .eq("exam_date", normalizedDate)
        .eq("shift", normalizedShift)
        .maybeSingle();

      let testId: string;

      if (existingTest) {
        testId = existingTest.id;
        console.log("Found existing test:", testId);
      } else {
        // Create new test with default marking rules
        const { data: newTest, error: testError } = await supabase
          .from("tests")
          .insert({
            name: `JEE Main - ${getExamDateLabel(normalizedDate)} ${normalizedShift}`,
            exam_date: normalizedDate,
            shift: normalizedShift,
            is_active: true,
            marking_rules_json: {
              mcq_single: { correct: 4, wrong: -1, unattempted: 0 },
              numerical: { correct: 4, wrong: -1, unattempted: 0 },
              msq: { correct: 4, wrong: -2, unattempted: 0 },
            },
          })
          .select("id")
          .single();

        if (testError) {
          console.error("Error creating test:", testError);
          throw testError;
        }
        testId = newTest.id;
        console.log("Created new test:", testId);
      }

      // 2. Prepare answer keys for upsert
      const keysToUpsert = keySet.keys.map((key) => ({
        test_id: testId,
        question_id: key.question_id,
        subject: key.subject,
        question_type: key.type,
        correct_option_ids: key.correct_option_ids || null,
        correct_numeric_value: key.correct_numeric_value ?? null,
        numeric_tolerance: 0,
        is_cancelled: false,
        is_bonus: false,
      }));

      console.log("Upserting", keysToUpsert.length, "answer keys");

      // 3. Upsert answer keys
      const { error: upsertError } = await supabase
        .from("answer_keys")
        .upsert(keysToUpsert, { onConflict: "test_id,question_id" });

      if (upsertError) {
        console.error("Error upserting keys:", upsertError);
        throw upsertError;
      }

      // 4. Verify the import by counting rows
      const { data: verifyData, error: verifyError } = await supabase
        .from("answer_keys")
        .select("subject")
        .eq("test_id", testId);

      if (verifyError) {
        console.error("Error verifying import:", verifyError);
      }

      const keyCount = verifyData?.length || 0;
      const mathCount = verifyData?.filter(k => k.subject === "Mathematics").length || 0;
      const physicsCount = verifyData?.filter(k => k.subject === "Physics").length || 0;
      const chemistryCount = verifyData?.filter(k => k.subject === "Chemistry").length || 0;

      console.log("Import verified:", { keyCount, mathCount, physicsCount, chemistryCount });

      // Store result for display
      setLastImportResult({
        testId,
        keyCount,
        mathCount,
        physicsCount,
        chemistryCount,
      });

      if (keyCount === 0) {
        setError("Import appeared to succeed but verification found 0 answer keys. Check database permissions.");
      } else {
        toast({
          title: "Import Successful!",
          description: `Verified ${keyCount} answer keys in database. Math: ${mathCount}, Physics: ${physicsCount}, Chemistry: ${chemistryCount}`,
        });
      }

      // Refresh tests list
      fetchTests();
    } catch (err) {
      console.error("Quick import error:", err);
      setError(`Failed to import answer keys: ${err instanceof Error ? err.message : "Unknown error"}`);
    } finally {
      setQuickImporting(false);
    }
  };

  const parseCSV = () => {
    if (!csvContent.trim()) {
      setError("Please enter CSV content");
      return;
    }

    setParsing(true);
    setError("");

    try {
      const lines = csvContent.trim().split("\n");
      const parsed: ParsedKey[] = [];

      // Skip header if present
      const startIndex = lines[0].toLowerCase().includes("question") ? 1 : 0;

      for (let i = startIndex; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;

        // Parse CSV - handle comma-separated values
        const parts = line.split(",").map((p) => p.trim());

        if (parts.length < 4) {
          console.warn(`Skipping invalid line ${i + 1}: ${line}`);
          continue;
        }

        const questionId = parts[0];
        const subject = parts[1];
        const questionType = parts[2].toLowerCase().replace(/[^a-z_]/g, "");
        const answer = parts[3];
        const isCancelled = parts[4]?.toLowerCase() === "true" || parts[4] === "1";
        const isBonus = parts[5]?.toLowerCase() === "true" || parts[5] === "1";

        // Validate question type
        const normalizedType = questionType.includes("numerical") ? "numerical" :
                              questionType.includes("msq") || questionType.includes("multi") ? "msq" :
                              "mcq_single";

        // Parse answer based on type
        let correctOptionIds: string[] | null = null;
        let correctNumericValue: number | null = null;
        let numericTolerance = 0;

        if (normalizedType === "numerical") {
          // Handle numeric with optional tolerance (e.g., "3.14" or "3.14±0.01")
          const numMatch = answer.match(/^(-?\d+\.?\d*)/);
          if (numMatch) {
            correctNumericValue = parseFloat(numMatch[1]);
          }
          const tolMatch = answer.match(/±(\d+\.?\d*)/);
          if (tolMatch) {
            numericTolerance = parseFloat(tolMatch[1]);
          }
        } else {
          // MCQ/MSQ - parse options (A, B, C, D or A,B,C)
          correctOptionIds = answer.split(/[,\s]+/).filter(Boolean).map((o) => o.toUpperCase());
        }

        parsed.push({
          question_id: questionId,
          subject: subject || "Mathematics",
          question_type: normalizedType,
          correct_option_ids: correctOptionIds,
          correct_numeric_value: correctNumericValue,
          numeric_tolerance: numericTolerance,
          is_cancelled: isCancelled,
          is_bonus: isBonus,
        });
      }

      if (parsed.length === 0) {
        setError("No valid answer keys found in CSV");
        return;
      }

      setParsedKeys(parsed);
      toast({
        title: "Parsed Successfully",
        description: `Found ${parsed.length} answer keys`,
      });
    } catch (err) {
      setError("Failed to parse CSV. Please check the format.");
    } finally {
      setParsing(false);
    }
  };

  const validateSelection = (): boolean => {
    let valid = true;
    setDateError("");
    setShiftError("");

    if (!selectedDate) {
      setDateError("Please select an exam date.");
      valid = false;
    }
    if (!selectedShift) {
      setShiftError("Please select a shift.");
      valid = false;
    }
    if (!selectedTestId) {
      setError("No test found for the selected date and shift.");
      valid = false;
    }
    return valid;
  };

  const handleUpload = async () => {
    if (!validateSelection()) {
      return;
    }

    if (parsedKeys.length === 0) {
      setError("Please parse the CSV first");
      return;
    }

    setLoading(true);
    setError("");

    try {
      // Delete existing answer keys for this test
      await supabase.from("answer_keys").delete().eq("test_id", selectedTestId);

      // Insert new answer keys
      const keysToInsert = parsedKeys.map((key) => ({
        test_id: selectedTestId,
        ...key,
      }));

      const { error: insertError } = await supabase.from("answer_keys").insert(keysToInsert);

      if (insertError) throw insertError;

      toast({
        title: "Success!",
        description: `Uploaded ${parsedKeys.length} answer keys`,
      });

      // Reset form
      setCsvContent("");
      setParsedKeys([]);
      navigate("/admin/tests");
    } catch (err) {
      console.error("Upload error:", err);
      setError("Failed to upload answer keys. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        setCsvContent(event.target?.result as string);
      };
      reader.readAsText(file);
    }
  };

  return (
    <div className="min-h-screen bg-muted/30">
      {/* Header */}
      <header className="bg-card border-b sticky top-0 z-50">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate("/admin/tests")}>
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <h1 className="text-xl font-bold">Upload Answer Keys</h1>
            <Badge variant="secondary">CSV</Badge>
          </div>
          <Button variant="ghost" size="sm" onClick={handleLogout}>
            <LogOut className="w-4 h-4 mr-2" />
            Logout
          </Button>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-3xl">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="space-y-6"
        >
          {/* Quick Import Section */}
          <Card className="border-primary/50 bg-primary/5">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Zap className="w-5 h-5 text-primary" />
                Quick Import (Built-in Keys)
              </CardTitle>
              <CardDescription>
                One-click import for available answer keys
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {BUILT_IN_KEYS.map((keySet) => {
                const stats = getBuiltInKeyStats(keySet.keys);
                return (
                  <div
                    key={`${keySet.exam_date}-${keySet.shift}`}
                    className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 bg-background rounded-lg border"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary">
                          <Calendar className="w-3 h-3 mr-1" />
                          {getExamDateLabel(keySet.exam_date)}
                        </Badge>
                        <Badge variant="outline">
                          <Clock className="w-3 h-3 mr-1" />
                          {keySet.shift}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {stats.total} questions • Math: {stats.mathematics}, Physics: {stats.physics}, Chemistry: {stats.chemistry}
                      </p>
                    </div>
                    <Button
                      onClick={() => handleQuickImport(keySet)}
                      disabled={quickImporting}
                      className="shrink-0"
                    >
                      {quickImporting ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Importing...
                        </>
                      ) : (
                        <>
                          <Zap className="w-4 h-4 mr-2" />
                          Import Answer Key
                        </>
                      )}
                    </Button>
                  </div>
                );
              })}
              
              {/* Import Verification Result */}
              {lastImportResult && (
                <Alert className="border-green-500/50 bg-green-500/10">
                  <CheckCircle className="h-4 w-4 text-green-600" />
                  <AlertDescription className="text-foreground">
                    <div className="space-y-1">
                      <p className="font-semibold">✓ Import Verified in Database</p>
                      <p className="text-sm">
                        Test ID: <code className="bg-muted px-1 rounded">{lastImportResult.testId.slice(0, 8)}...</code>
                      </p>
                      <p className="text-sm">
                        Total Keys: <strong>{lastImportResult.keyCount}</strong> • 
                        Math: {lastImportResult.mathCount} • 
                        Physics: {lastImportResult.physicsCount} • 
                        Chemistry: {lastImportResult.chemistryCount}
                      </p>
                    </div>
                  </AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>

          {/* Instructions */}
          <Card>
            <CardHeader>
              <CardTitle>CSV Format</CardTitle>
              <CardDescription>
                Upload answer keys in the following CSV format
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="bg-muted p-4 rounded-lg font-mono text-sm overflow-x-auto">
                <p className="text-muted-foreground mb-2"># Header (optional):</p>
                <p>question_id,subject,type,answer,is_cancelled,is_bonus</p>
                <p className="text-muted-foreground mt-4 mb-2"># Examples:</p>
                <p>Q001,Mathematics,mcq_single,B,false,false</p>
                <p>Q002,Physics,msq,A C D,false,false</p>
                <p>Q003,Chemistry,numerical,3.14,false,false</p>
                <p>Q004,Mathematics,mcq_single,-,true,false</p>
              </div>
            </CardContent>
          </Card>

          {/* Upload Form */}
          <Card>
            <CardHeader>
              <CardTitle>Upload Answer Key</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Exam Date and Shift Selection */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Exam Date Dropdown - Hardcoded Options */}
                <div className="space-y-2">
                  <Label htmlFor="exam-date" className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-muted-foreground" />
                    Exam Date
                  </Label>
                  <Select value={selectedDate} onValueChange={(value) => {
                    setSelectedDate(value);
                    setDateError("");
                  }}>
                    <SelectTrigger id="exam-date" className={dateError ? "border-destructive" : ""}>
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
                  {dateError && (
                    <p className="text-xs text-destructive">{dateError}</p>
                  )}
                </div>

                {/* Shift Dropdown */}
                <div className="space-y-2">
                  <Label htmlFor="shift" className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-muted-foreground" />
                    Shift
                  </Label>
                  <Select 
                    value={selectedShift} 
                    onValueChange={(value) => {
                      setSelectedShift(value);
                      setShiftError("");
                    }}
                    disabled={!selectedDate}
                  >
                    <SelectTrigger id="shift" className={shiftError ? "border-destructive" : ""}>
                      <SelectValue placeholder="Select shift" />
                    </SelectTrigger>
                    <SelectContent>
                      {availableShifts.length === 0 ? (
                        <SelectItem value="none" disabled>
                          No shifts available
                        </SelectItem>
                      ) : (
                        availableShifts.map((shift) => (
                          <SelectItem key={shift} value={shift}>
                            {shift}
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                  {!selectedDate && !shiftError && (
                    <p className="text-xs text-muted-foreground">Select an exam date first</p>
                  )}
                  {shiftError && (
                    <p className="text-xs text-destructive">{shiftError}</p>
                  )}
                </div>
              </div>

              {/* File Upload */}
              <div className="space-y-2">
                <Label>Upload CSV File (optional)</Label>
                <div className="border-2 border-dashed rounded-lg p-4 text-center hover:border-primary/50 transition-colors">
                  <input
                    type="file"
                    accept=".csv,.txt"
                    onChange={handleFileUpload}
                    className="hidden"
                    id="csv-file"
                  />
                  <label htmlFor="csv-file" className="cursor-pointer">
                    <FileText className="w-8 h-8 mx-auto text-muted-foreground mb-2" />
                    <p className="text-sm text-muted-foreground">
                      Click to upload or drag and drop
                    </p>
                  </label>
                </div>
              </div>

              {/* CSV Content */}
              <div className="space-y-2">
                <Label htmlFor="csv">CSV Content</Label>
                <Textarea
                  id="csv"
                  placeholder="Paste CSV content here..."
                  value={csvContent}
                  onChange={(e) => setCsvContent(e.target.value)}
                  rows={10}
                  className="font-mono text-sm"
                />
              </div>

              {/* Error */}
              {error && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              {/* Parsed Preview */}
              {parsedKeys.length > 0 && (
                <Alert>
                  <CheckCircle className="h-4 w-4 text-success" />
                  <AlertDescription>
                    Parsed {parsedKeys.length} answer keys. Click "Upload" to save.
                  </AlertDescription>
                </Alert>
              )}

              {/* Actions */}
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={parseCSV}
                  disabled={parsing || !csvContent.trim()}
                  className="flex-1"
                >
                  {parsing ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Parsing...
                    </>
                  ) : (
                    "Parse CSV"
                  )}
                </Button>
                <Button
                  onClick={handleUpload}
                  disabled={loading || parsedKeys.length === 0 || !selectedTestId}
                  className="flex-1"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Uploading...
                    </>
                  ) : (
                    <>
                      <Upload className="w-4 h-4 mr-2" />
                      Upload {parsedKeys.length} Keys
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </main>
    </div>
  );
};

export default AdminUploadKey;
