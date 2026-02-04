import { useState, useEffect, useCallback } from "react";
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
import { Upload, Link as LinkIcon, FileText, Loader2, AlertCircle, Zap, Calendar, Clock, Bug, ChevronDown, ChevronUp, CheckCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { parseResponseSheetHTML, validateResponseSheet, getParsingDiagnostic, getDigialmDebugInfo, ParserDebugInfo } from "@/lib/parser";
import { calculateScores } from "@/lib/scoring";
import { Test, MarkingRules, ParsedResponse } from "@/lib/types";
import { useToast } from "@/hooks/use-toast";
import { EXAM_DATES, SHIFTS } from "@/lib/examDates";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
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
  const [tests, setTests] = useState<Test[]>([]);
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [dateError, setDateError] = useState("");
  const [shiftError, setShiftError] = useState("");
  const [showUploadFallback, setShowUploadFallback] = useState(false);
  
  // Debug and verification state
  const [debugInfo, setDebugInfo] = useState<ParserDebugInfo | null>(null);
  const [showDebug, setShowDebug] = useState(false);
  const [parsedPreview, setParsedPreview] = useState<{
    count: number;
    math: number;
    physics: number;
    chemistry: number;
    numerical: number;
  } | null>(null);
  const [pendingHtml, setPendingHtml] = useState<string | null>(null);
  const [pendingSourceType, setPendingSourceType] = useState<"url" | "html">("url");

  useEffect(() => {
    fetchAllTests();
  }, []);

  // Fetch all active tests for reference

  const fetchAllTests = async () => {
    const { data, error } = await supabase
      .from("tests")
      .select("*")
      .eq("is_active", true)
      .not("exam_date", "is", null);

    if (data) {
      setTests(data as unknown as Test[]);
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

  // Count responses by subject (heuristic based on question order)
  const countBySubject = (responses: ParsedResponse[]): { math: number; physics: number; chemistry: number; numerical: number } => {
    const total = responses.length;
    // JEE Main typically has 25 questions per subject (20 MCQ + 5 Numerical for each)
    // Questions are usually in order: Math (1-25), Physics (26-50), Chemistry (51-75)
    let numerical = 0;
    responses.forEach(r => {
      if (r.claimed_numeric_value !== undefined) numerical++;
    });
    
    // Rough distribution
    const perSubject = Math.ceil(total / 3);
    return {
      math: Math.min(perSubject, total),
      physics: Math.min(perSubject, Math.max(0, total - perSubject)),
      chemistry: Math.max(0, total - 2 * perSubject),
      numerical,
    };
  };

  // Step 1: Parse and preview (don't save yet)
  const parseAndPreview = async (htmlContent: string, sourceType: "url" | "html") => {
    // Validate the HTML
    const validation = validateResponseSheet(htmlContent);
    if (!validation.valid) {
      const debug = getDigialmDebugInfo(htmlContent);
      setDebugInfo(debug);
      throw new Error(validation.message);
    }

    // Parse responses from HTML
    const parsedResponses = parseResponseSheetHTML(htmlContent);
    
    // Generate debug info
    const debug = getDigialmDebugInfo(htmlContent);
    debug.responseCount = parsedResponses.length;
    debug.strategyUsed = parsedResponses.length > 0 ? "success" : "failed";
    setDebugInfo(debug);
    
    if (parsedResponses.length === 0) {
      const diagnostic = getParsingDiagnostic(htmlContent);
      throw new Error(diagnostic);
    }

    // Show preview and store pending data
    const counts = countBySubject(parsedResponses);
    setParsedPreview({
      count: parsedResponses.length,
      ...counts,
    });
    setPendingHtml(htmlContent);
    setPendingSourceType(sourceType);
    
    return parsedResponses.length;
  };

  // Step 2: Confirm and save
  const confirmAndSave = async () => {
    if (!pendingHtml) return;
    
    setLoading(true);
    try {
      const submissionId = await processAnalysis(pendingHtml, pendingSourceType);
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

  const processAnalysis = useCallback(async (htmlContent: string, sourceType: "url" | "html") => {
    // Parse responses from HTML (already validated in preview step)
    const parsedResponses = parseResponseSheetHTML(htmlContent);
    if (parsedResponses.length === 0) {
      const diagnostic = getParsingDiagnostic(htmlContent);
      throw new Error(diagnostic);
    }

    // Get the selected test
    const selectedTest = tests.find((t) => t.id === selectedTestId);
    if (!selectedTest) {
      throw new Error("Please select a valid exam date and shift.");
    }

    // Get answer keys for the test
    const { data: answerKeys, error: akError } = await supabase
      .rpc("get_answer_keys_for_test", { p_test_id: selectedTestId });

    if (akError || !answerKeys || answerKeys.length === 0) {
      throw new Error("No answer keys found for this test. Please contact admin.");
    }

    // Create submission first
    const { data: submission, error: subError } = await supabase
      .from("submissions")
      .insert({
        test_id: selectedTestId,
        source_type: sourceType,
        share_enabled: true,
      })
      .select()
      .single();

    if (subError || !submission) {
      throw new Error("Failed to create submission. Please try again.");
    }

    // Calculate scores
    const markingRules = selectedTest.marking_rules_json as unknown as MarkingRules;
    const scoringResult = calculateScores(
      parsedResponses,
      answerKeys,
      markingRules,
      submission.id
    );

    // Insert responses
    const { error: respError } = await supabase
      .from("responses")
      .insert(scoringResult.responses);

    if (respError) {
      console.error("Error inserting responses:", respError);
    }

    // Update submission with scores
    const { error: updateError } = await supabase
      .from("submissions")
      .update(scoringResult.summary)
      .eq("id", submission.id);

    if (updateError) {
      console.error("Error updating submission:", updateError);
    }

    return submission.id;
  }, [selectedTestId, tests]);

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

  const isSubmitDisabled = !selectedDate || !selectedShift || loading;

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
                      <div className="space-y-2">
                        <p className="font-semibold">✓ Parsed {parsedPreview.count} responses successfully!</p>
                        <div className="text-sm grid grid-cols-2 gap-2">
                          <span>Mathematics: ~{parsedPreview.math} questions</span>
                          <span>Physics: ~{parsedPreview.physics} questions</span>
                          <span>Chemistry: ~{parsedPreview.chemistry} questions</span>
                          <span>Numerical (Section B): {parsedPreview.numerical} questions</span>
                        </div>
                        <Button 
                          onClick={confirmAndSave}
                          disabled={loading}
                          className="w-full mt-3"
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
                {debugInfo && !parsedPreview && (
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
                      <div className="p-4 bg-muted rounded-lg text-xs font-mono space-y-3 max-h-96 overflow-auto">
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
