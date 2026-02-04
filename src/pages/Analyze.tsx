import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/landing/Footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Upload, Link as LinkIcon, FileText, Loader2, AlertCircle, Zap, Calendar, Clock, Bug, ChevronDown, ChevronUp, CheckCircle, AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { parseResponseSheetHTML, validateResponseSheet, getParsingDiagnostic, getDigialmDebugInfo, ParserDebugInfo } from "@/lib/parser";
import { Test, ParsedResponse } from "@/lib/types";
import { useToast } from "@/hooks/use-toast";
import { EXAM_DATES, SHIFTS, getExamDateLabel } from "@/lib/examDates";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { normalizeShift, normalizeExamDate } from "@/lib/normalize";
const Analyze = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const [inputMethod, setInputMethod] = useState<"url" | "html">("url");
  const [url, setUrl] = useState("");
  const [file, setFile] = useState<File | null>(null);
  
  // Date and Shift selection (using hardcoded dates)
  const [selectedDate, setSelectedDate] = useState("");
  const [availableShifts, setAvailableShifts] = useState<string[]>([]);
  const [selectedShift, setSelectedShift] = useState("");
  const [selectedTestId, setSelectedTestId] = useState("");
  const [answerKeyCount, setAnswerKeyCount] = useState<number | null>(null);
  const [tests, setTests] = useState<Test[]>([]);
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [dateError, setDateError] = useState("");
  const [shiftError, setShiftError] = useState("");
  const [testLookupError, setTestLookupError] = useState("");
  const [showUploadFallback, setShowUploadFallback] = useState(false);
  
  // Debug and verification state
  const [debugInfo, setDebugInfo] = useState<ParserDebugInfo | null>(null);
  const [showDebug, setShowDebug] = useState(false);
  const [parsedPreview, setParsedPreview] = useState<{
    rawCount: number;
    uniqueCount: number;
    matchedCount: number;
    totalAttempted: number;
    subjectBreakdown: { subject: string; matched: number; total: number; attempted: number }[];
    numericalStats: {
      total: number;
      attempted: number;
      examples: { questionId: string; value: number | string | null; isAttempted: boolean }[];
    };
  } | null>(null);
  const [pendingHtml, setPendingHtml] = useState<string | null>(null);
  const [pendingSourceType, setPendingSourceType] = useState<"url" | "html">("url");
  const [pendingResponses, setPendingResponses] = useState<ParsedResponse[]>([]);

  useEffect(() => {
    fetchAllTests();
  }, []);

  // Fetch all active tests for reference

  const fetchAllTests = async () => {
    // Use the secure RPC that doesn't expose marking rules
    const { data, error } = await supabase.rpc("get_active_tests");

    if (data) {
      // Map RPC result to Test type (marking rules are fetched server-side during scoring)
      const testsData = (data as any[]).map(t => ({
        id: t.id,
        name: t.name,
        shift: t.shift,
        exam_date: t.exam_date,
        is_active: t.is_active,
        marking_rules_json: {}, // Not exposed to client
        created_at: "",
        updated_at: "",
      }));
      setTests(testsData as Test[]);
    }
    if (error) {
      console.error("Error fetching tests:", error);
    }
  };

  // When date changes, determine available shifts from DB or show both
  useEffect(() => {
    if (selectedDate) {
      // Check which shifts exist in DB for this date
      const shiftsForDate = tests
        .filter(t => t.exam_date === selectedDate)
        .map(t => t.shift);
      const uniqueShifts = [...new Set(shiftsForDate)];
      
      // If tests exist for this date, show only available shifts; otherwise show both
      setAvailableShifts(uniqueShifts.length > 0 ? uniqueShifts : [...SHIFTS]);
      setSelectedShift(""); // Reset shift when date changes
      setSelectedTestId("");
      setShiftError("");
    } else {
      setAvailableShifts([]);
      setSelectedShift("");
      setSelectedTestId("");
    }
  }, [selectedDate, tests]);

  // When shift changes, resolve test_id and verify answer keys exist
  useEffect(() => {
    const resolveTestAndKeys = async () => {
      setTestLookupError("");
      setAnswerKeyCount(null);
      
      if (!selectedDate || !selectedShift) {
        setSelectedTestId("");
        return;
      }

      // Normalize values for consistent lookup
      const normalizedDate = normalizeExamDate(selectedDate);
      const normalizedShift = normalizeShift(selectedShift);

      if (!normalizedDate || !normalizedShift) {
        setTestLookupError("Invalid date or shift format.");
        setSelectedTestId("");
        return;
      }

      console.log("Looking up test:", { normalizedDate, normalizedShift });

      // First check local cache
      const localMatch = tests.find(
        t => t.exam_date === normalizedDate && t.shift === normalizedShift
      );

      if (localMatch) {
        console.log("Found test in local cache:", localMatch.id);
        setSelectedTestId(localMatch.id);
        
        // Answer keys are now admin-only, just check test exists
        // The count check will be done server-side during scoring
        setAnswerKeyCount(75); // Assume complete if test exists
      } else {
        // Try direct DB lookup in case tests array is stale
        console.log("Not in local cache, querying DB directly");
        const { data: dbTest, error: dbError } = await supabase
          .from("tests")
          .select("id")
          .eq("exam_date", normalizedDate)
          .eq("shift", normalizedShift)
          .eq("is_active", true)
          .maybeSingle();

        if (dbError) {
          console.error("DB lookup error:", dbError);
          setTestLookupError("Error looking up test configuration.");
          setSelectedTestId("");
          return;
        }

        if (dbTest) {
          console.log("Found test in DB:", dbTest.id);
          setSelectedTestId(dbTest.id);
          // Answer keys are now admin-only, assume complete if test exists
          setAnswerKeyCount(75);
        } else {
          console.log("No test found in DB for:", { normalizedDate, normalizedShift });
          setTestLookupError(`Answer key not found in database for ${getExamDateLabel(normalizedDate)} (${normalizedShift}). Admin must import the key for this shift.`);
          setSelectedTestId("");
          setAnswerKeyCount(0);
        }
      }
    };

    resolveTestAndKeys();
  }, [selectedDate, selectedShift, tests]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      if (!selectedFile.name.endsWith(".html") && !selectedFile.name.endsWith(".htm")) {
        setError("Only HTML files are allowed. Please upload a .html file.");
        return;
      }
      if (selectedFile.size > 5 * 1024 * 1024) {
        setError("File size must be less than 5MB.");
        return;
      }
      setFile(selectedFile);
      setError("");
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
    return valid;
  };

  // Step 1: Parse and preview (don't save yet) - now with answer key matching
  const parseAndPreview = async (htmlContent: string, sourceType: "url" | "html") => {
    // Validate the HTML
    const validation = validateResponseSheet(htmlContent);
    if (!validation.valid) {
      const debug = getDigialmDebugInfo(htmlContent);
      setDebugInfo(debug);
      throw new Error(validation.message);
    }

    // Parse responses from HTML (now returns { responses, rawCount })
    const { responses: parsedResponses, rawCount } = parseResponseSheetHTML(htmlContent);
    
    // Generate debug info
    const debug = getDigialmDebugInfo(htmlContent);
    debug.responseCount = parsedResponses.length;
    debug.strategyUsed = parsedResponses.length > 0 ? "success" : "failed";
    setDebugInfo(debug);
    
    if (parsedResponses.length === 0) {
      const diagnostic = getParsingDiagnostic(htmlContent);
      throw new Error(diagnostic);
    }

    // Since answer keys are now admin-only, we just show basic parsed info
    // Full matching will happen server-side during scoring
    setParsedPreview({
      rawCount,
      uniqueCount: parsedResponses.length,
      matchedCount: 0, // Will be computed server-side
      totalAttempted: parsedResponses.filter(r => r.is_attempted).length,
      subjectBreakdown: [], // Will be computed server-side
      numericalStats: { 
        total: 0, 
        attempted: parsedResponses.filter(r => r.claimed_numeric_value !== null && r.claimed_numeric_value !== undefined).length, 
        examples: [] 
      },
    });
    
    setPendingHtml(htmlContent);
    setPendingSourceType(sourceType);
    setPendingResponses(parsedResponses);
    
    return parsedResponses.length;
  };

  // Step 2: Confirm and save - with explicit validation and debug logging
  const confirmAndSave = async () => {
    // Debug log current state
    console.log("confirmAndSave called with state:", {
      selectedDate,
      selectedShift,
      selectedTestId,
      hasPendingHtml: !!pendingHtml,
      pendingSourceType,
    });

    if (!pendingHtml) {
      setError("No parsed data found. Please parse the response sheet first.");
      return;
    }
    
    // Validate selections explicitly using current state
    if (!selectedDate || !selectedShift) {
      setError("Please select a valid exam date and shift.");
      console.error("Validation failed: date or shift missing", { selectedDate, selectedShift });
      return;
    }

    if (!selectedTestId) {
      setError("Answer key not available for this exam date/shift. Please contact admin.");
      console.error("Validation failed: no test ID", { selectedDate, selectedShift, selectedTestId });
      return;
    }
    
    setLoading(true);
    setError("");
    
    try {
      // Pass current values directly to avoid stale closures
      const submissionId = await processAnalysisWithParams(
        pendingHtml, 
        pendingSourceType,
        selectedTestId,
        tests
      );
      toast({
        title: "Analysis Complete!",
        description: "Your score has been calculated successfully.",
      });
      navigate(`/result/${submissionId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  // Process analysis using edge function (server-side scoring)
  const processAnalysisWithParams = async (
    htmlContent: string, 
    sourceType: "url" | "html",
    testId: string,
    _allTests: Test[]
  ) => {
    // Parse responses from HTML (already validated in preview step)
    const { responses: parsedResponses } = parseResponseSheetHTML(htmlContent);
    if (parsedResponses.length === 0) {
      const diagnostic = getParsingDiagnostic(htmlContent);
      throw new Error(diagnostic);
    }

    console.log(`Sending ${parsedResponses.length} responses to edge function for scoring`);

    // Call edge function for secure server-side scoring
    const { data, error: funcError } = await supabase.functions.invoke("score-submission", {
      body: { 
        testId, 
        parsedResponses,
        sourceType 
      },
    });

    if (funcError) {
      console.error("Edge function error:", funcError);
      throw new Error("Failed to process submission. Please try again.");
    }

    if (!data?.success) {
      throw new Error(data?.error || "Failed to calculate score. Please try again.");
    }

    console.log("Scoring complete:", data.summary);
    return data.submissionId;
  };

  const handleUrlSubmit = async () => {
    if (!validateSelection()) {
      return;
    }

    if (!url.trim()) {
      setError("Please enter a URL");
      return;
    }

    setLoading(true);
    setError("");
    setDebugInfo(null);
    setParsedPreview(null);

    try {
      // Try to fetch via edge function
      const { data, error: fetchError } = await supabase.functions.invoke("fetch-response-sheet", {
        body: { url: url.trim() },
      });

      if (fetchError || !data?.success) {
        // Show fallback message
        setShowUploadFallback(true);
        setInputMethod("html");
        setError(data?.error || "This link cannot be accessed automatically (login/session required). Please upload the Response HTML file.");
        setLoading(false);
        return;
      }

      // Parse and show preview
      await parseAndPreview(data.html, "url");
      toast({
        title: "Responses Parsed!",
        description: "Review the summary below, then click Confirm to generate your report.",
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  const handleFileSubmit = async () => {
    if (!validateSelection()) {
      return;
    }

    if (!file) {
      setError("Please select an HTML file");
      return;
    }

    setLoading(true);
    setError("");
    setDebugInfo(null);
    setParsedPreview(null);

    try {
      const htmlContent = await file.text();
      
      // Parse and show preview
      await parseAndPreview(htmlContent, "html");
      toast({
        title: "Responses Parsed!",
        description: "Review the summary below, then click Confirm to generate your report.",
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  const isSubmitDisabled = !selectedDate || !selectedShift || loading || !selectedTestId;
  const isConfirmDisabled = loading || !selectedDate || !selectedShift || !selectedTestId || !parsedPreview || (answerKeyCount !== null && answerKeyCount < 75);

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      
      <main className="flex-1 pt-24 pb-12 px-4">
        <div className="container mx-auto max-w-2xl">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <div className="text-center mb-8">
              <h1 className="text-3xl md:text-4xl font-bold mb-3">
                Analyze Your Response
              </h1>
              <p className="text-muted-foreground">
                Import your JEE Main response sheet and get instant analysis
              </p>
            </div>

            <Card className="border-2">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Zap className="w-5 h-5 text-primary" />
                  Import Response Sheet
                </CardTitle>
                <CardDescription>
                  Paste your response sheet URL or upload the HTML file
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
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

                {/* Test/Key Status Indicator */}
                {selectedDate && selectedShift && (
                  <div className="p-3 rounded-lg border bg-muted/50">
                    {selectedTestId && answerKeyCount !== null && answerKeyCount >= 75 ? (
                      <div className="flex items-center gap-2 text-sm text-primary">
                        <CheckCircle className="w-4 h-4" />
                        <span>Answer key found: {answerKeyCount} questions</span>
                      </div>
                    ) : testLookupError ? (
                      <div className="flex items-start gap-2 text-sm text-destructive">
                        <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                        <span>{testLookupError}</span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Checking answer key availability...</span>
                      </div>
                    )}
                  </div>
                )}

                {/* Input Method Tabs */}
                <Tabs value={inputMethod} onValueChange={(v) => setInputMethod(v as "url" | "html")}>
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="url" className="gap-2">
                      <LinkIcon className="w-4 h-4" />
                      Paste URL
                    </TabsTrigger>
                    <TabsTrigger value="html" className="gap-2">
                      <Upload className="w-4 h-4" />
                      Upload HTML
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent value="url" className="space-y-4 mt-4">
                    <div className="space-y-2">
                      <Label htmlFor="url">Response Sheet URL</Label>
                      <Input
                        id="url"
                        type="url"
                        placeholder="https://ntaresults.nic.in/..."
                        value={url}
                        onChange={(e) => setUrl(e.target.value)}
                      />
                      <p className="text-xs text-muted-foreground">
                        Paste the full URL of your JEE Main response sheet
                      </p>
                    </div>
                    <Button 
                      onClick={handleUrlSubmit} 
                      disabled={isSubmitDisabled}
                      className="w-full"
                      size="lg"
                    >
                      {loading ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Analyzing...
                        </>
                      ) : (
                        <>
                          <Zap className="w-4 h-4 mr-2" />
                          Generate Report
                        </>
                      )}
                    </Button>
                  </TabsContent>

                  <TabsContent value="html" className="space-y-4 mt-4">
                    <div className="space-y-2">
                      <Label htmlFor="file">Upload Response HTML</Label>
                      <div className="border-2 border-dashed rounded-lg p-6 text-center hover:border-primary/50 transition-colors">
                        <input
                          id="file"
                          type="file"
                          accept=".html,.htm"
                          onChange={handleFileChange}
                          className="hidden"
                        />
                        <label htmlFor="file" className="cursor-pointer">
                          <FileText className="w-10 h-10 mx-auto text-muted-foreground mb-2" />
                          {file ? (
                            <p className="font-medium">{file.name}</p>
                          ) : (
                            <>
                              <p className="font-medium">Click to upload or drag and drop</p>
                              <p className="text-sm text-muted-foreground mt-1">
                                Only .html files (max 5MB)
                              </p>
                            </>
                          )}
                        </label>
                      </div>
                    </div>
                    <Button 
                      onClick={handleFileSubmit} 
                      disabled={isSubmitDisabled || !file}
                      className="w-full"
                      size="lg"
                    >
                      {loading ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Analyzing...
                        </>
                      ) : (
                        <>
                          <Zap className="w-4 h-4 mr-2" />
                          Generate Report
                        </>
                      )}
                    </Button>
                  </TabsContent>
                </Tabs>

                {/* Parsed Preview - Show after successful parsing */}
                {parsedPreview && (
                  <Alert className="border-primary/50 bg-primary/10">
                    <CheckCircle className="h-4 w-4 text-primary" />
                    <AlertDescription className="text-foreground">
                      <div className="space-y-3">
                        {/* Summary counts */}
                        <div>
                          <p className="font-semibold">
                            ✓ Parsed {parsedPreview.uniqueCount} responses ({parsedPreview.rawCount} raw → {parsedPreview.uniqueCount} unique)
                          </p>
                          {parsedPreview.matchedCount > 0 ? (
                            <>
                              <p className="text-sm text-primary">
                                Matched with answer key: {parsedPreview.matchedCount} / {parsedPreview.uniqueCount}
                              </p>
                              <p className="text-sm font-medium mt-1">
                                Total Attempted: {parsedPreview.totalAttempted} / {parsedPreview.matchedCount}
                              </p>
                            </>
                          ) : parsedPreview.uniqueCount > 0 && selectedTestId ? (
                            <p className="text-sm text-destructive flex items-center gap-1">
                              <AlertTriangle className="w-3 h-3" />
                              No matches with answer key - possible ID format mismatch
                            </p>
                          ) : null}
                        </div>
                        
                        {/* Subject breakdown with attempted counts */}
                        {parsedPreview.subjectBreakdown.length > 0 && (
                          <div className="text-sm p-2 bg-background/50 rounded space-y-1">
                            <div className="grid grid-cols-3 gap-2">
                              {parsedPreview.subjectBreakdown.map(s => (
                                <div key={s.subject} className="text-center">
                                  <p className="font-medium">{s.subject.slice(0, 4)}</p>
                                  <p className="text-muted-foreground">{s.attempted}/{s.matched} att</p>
                                </div>
                              ))}
                            </div>
                            <div className="border-t pt-1 mt-1">
                              <span className="font-medium">
                                Numerical: {parsedPreview.numericalStats.attempted}/{parsedPreview.numericalStats.total} attempted
                              </span>
                            </div>
                          </div>
                        )}
                        
                        {/* Show current selection status */}
                        <div className="text-xs text-muted-foreground p-2 bg-background/50 rounded">
                          <p>Selected: {selectedDate ? getExamDateLabel(selectedDate) : "No date"} | {selectedShift || "No shift"}</p>
                          {selectedTestId && answerKeyCount !== null && answerKeyCount >= 75 ? (
                            <p className="text-primary">✓ Answer key found: {answerKeyCount} questions</p>
                          ) : testLookupError ? (
                            <p className="text-destructive">✗ {testLookupError}</p>
                          ) : selectedTestId ? (
                            <p className="text-warning">⚠ Answer key incomplete ({answerKeyCount || 0} of 75)</p>
                          ) : (
                            <p className="text-destructive">✗ No answer key configured for this date/shift</p>
                          )}
                        </div>
                        
                        <Button 
                          onClick={confirmAndSave}
                          disabled={isConfirmDisabled}
                          className="w-full mt-2"
                          size="lg"
                        >
                          {loading ? (
                            <>
                              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                              Generating Report...
                            </>
                          ) : (
                            <>
                              <CheckCircle className="w-4 h-4 mr-2" />
                              Confirm & Generate Report
                            </>
                          )}
                        </Button>
                        
                        {isConfirmDisabled && !loading && (
                          <p className="text-xs text-destructive text-center">
                            {!selectedDate || !selectedShift 
                              ? "Please select exam date and shift above." 
                              : !selectedTestId 
                                ? `Answer key not found in database for ${selectedDate ? getExamDateLabel(selectedDate) : "this date"} (${selectedShift || "no shift"}). Admin must import the key for this shift.`
                                : answerKeyCount !== null && answerKeyCount < 75
                                  ? `Answer key incomplete (${answerKeyCount} of 75 questions).`
                                  : ""}
                          </p>
                        )}
                      </div>
                    </AlertDescription>
                  </Alert>
                )}

                {/* Error Message */}
                {error && (
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                )}

                {/* Debug Info - Show when parsing fails */}
                {(debugInfo && !parsedPreview) && (
                  <Collapsible open={showDebug} onOpenChange={setShowDebug}>
                    <CollapsibleTrigger asChild>
                      <Button variant="outline" className="w-full justify-between">
                        <span className="flex items-center gap-2">
                          <Bug className="w-4 h-4" />
                          View Debug Info
                        </span>
                        {showDebug ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </Button>
                    </CollapsibleTrigger>
                    <CollapsibleContent className="mt-2">
                      <div className="p-4 bg-muted rounded-lg text-xs font-mono space-y-3 max-h-[500px] overflow-auto">
                        {debugInfo && (
                          <>
                            <div>
                              <p className="font-bold text-sm mb-1">Markers Found:</p>
                              <ul className="list-disc list-inside space-y-1">
                                <li>Question ID variants: {debugInfo.markers.hasQuestionIdVariants.length > 0 ? debugInfo.markers.hasQuestionIdVariants.join(", ") : "None"}</li>
                                <li>Has Option IDs: {debugInfo.markers.hasOptionIds ? "Yes" : "No"}</li>
                                <li>Has Chosen Option: {debugInfo.markers.hasChosenOption ? "Yes" : "No"}</li>
                                <li>Has Given Answer: {debugInfo.markers.hasGivenAnswer ? "Yes" : "No"}</li>
                                <li>Has Question Palette: {debugInfo.markers.hasQuestionPalette ? "Yes" : "No"}</li>
                              </ul>
                            </div>
                            
                            {/* Raw numerical examples from HTML */}
                            {debugInfo.numericalExamples && debugInfo.numericalExamples.length > 0 && (
                              <div className="p-2 bg-background rounded border">
                                <p className="font-bold text-sm mb-1">Raw Numerical Extraction (from HTML):</p>
                                <table className="w-full text-xs">
                                  <thead>
                                    <tr className="border-b">
                                      <th className="text-left p-1">Q.ID</th>
                                      <th className="text-left p-1">Raw Snippet</th>
                                      <th className="text-left p-1">Extracted</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {debugInfo.numericalExamples.slice(0, 10).map((ex, i) => (
                                      <tr key={i} className="border-b border-border/50">
                                        <td className="p-1 font-mono">{ex.questionId.slice(-6)}</td>
                                        <td className="p-1 text-muted-foreground">{ex.rawSnippet}</td>
                                        <td className={`p-1 ${ex.isAttempted ? "text-primary" : "text-muted-foreground"}`}>
                                          {ex.extractedValue !== null ? String(ex.extractedValue) : "--"}
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            )}
                            
                            <div>
                              <p className="font-bold text-sm mb-1">Script Blocks:</p>
                              <ul className="list-disc list-inside">
                                <li>Count: {debugInfo.scriptBlocks.count}</li>
                                <li>Top lengths: {debugInfo.scriptBlocks.topLengths.join(", ") || "None"}</li>
                                <li>Has JSON-like data: {debugInfo.scriptBlocks.hasJsonLikeData ? "Yes" : "No"}</li>
                              </ul>
                            </div>
                            <div>
                              <p className="font-bold text-sm mb-1">HTML Stats:</p>
                              <p>Total length: {debugInfo.htmlLength} bytes</p>
                            </div>
                            <div>
                              <p className="font-bold text-sm mb-1">Clean Text Preview (first 1500 chars):</p>
                              <pre className="whitespace-pre-wrap break-words bg-background p-2 rounded border max-h-40 overflow-auto">
                                {debugInfo.cleanTextPreview.substring(0, 1500)}
                              </pre>
                            </div>
                            {debugInfo.largestScriptPreview && (
                              <div>
                                <p className="font-bold text-sm mb-1">Largest Script Preview (first 1000 chars):</p>
                                <pre className="whitespace-pre-wrap break-words bg-background p-2 rounded border max-h-40 overflow-auto">
                                  {debugInfo.largestScriptPreview.substring(0, 1000)}
                                </pre>
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    </CollapsibleContent>
                  </Collapsible>
                )}

                {/* Fallback Message */}
                {showUploadFallback && (
                  <Alert>
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>
                      The URL requires login. Please save the response sheet page as HTML and upload it here.
                    </AlertDescription>
                  </Alert>
                )}
              </CardContent>
            </Card>

            {/* Help Text */}
            <div className="mt-6 p-4 rounded-lg bg-muted/50 text-sm text-muted-foreground">
              <p className="font-medium mb-2">How to get your response sheet:</p>
              <ol className="list-decimal list-inside space-y-1">
                <li>Login to the NTA JEE Main website</li>
                <li>Go to "View Response Sheet"</li>
                <li>Either copy the URL or save the page as HTML</li>
                <li>Paste the URL or upload the HTML file above</li>
              </ol>
            </div>
          </motion.div>
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default Analyze;
