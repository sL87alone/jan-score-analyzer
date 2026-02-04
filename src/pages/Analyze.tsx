import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { format } from "date-fns";
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
import { Upload, Link as LinkIcon, FileText, Loader2, AlertCircle, Zap, Calendar, Clock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { parseResponseSheetHTML, validateResponseSheet } from "@/lib/parser";
import { calculateScores } from "@/lib/scoring";
import { Test, MarkingRules } from "@/lib/types";
import { useToast } from "@/hooks/use-toast";

const Analyze = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const [inputMethod, setInputMethod] = useState<"url" | "html">("url");
  const [url, setUrl] = useState("");
  const [file, setFile] = useState<File | null>(null);
  
  // Date and Shift selection
  const [examDates, setExamDates] = useState<string[]>([]);
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

  useEffect(() => {
    fetchExamDates();
    fetchAllTests();
  }, []);

  // Fetch distinct exam dates
  const fetchExamDates = async () => {
    const { data, error } = await supabase
      .from("tests")
      .select("exam_date")
      .eq("is_active", true)
      .not("exam_date", "is", null)
      .order("exam_date", { ascending: true });

    if (data) {
      // Get unique dates
      const uniqueDates = [...new Set(data.map(t => t.exam_date).filter(Boolean))] as string[];
      setExamDates(uniqueDates);
    }
    if (error) {
      console.error("Error fetching exam dates:", error);
    }
  };

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

  // When date changes, fetch available shifts
  useEffect(() => {
    if (selectedDate) {
      const shiftsForDate = tests
        .filter(t => t.exam_date === selectedDate)
        .map(t => t.shift);
      setAvailableShifts([...new Set(shiftsForDate)]);
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

  const processAnalysis = useCallback(async (htmlContent: string, sourceType: "url" | "html") => {
    // Validate the HTML
    const validation = validateResponseSheet(htmlContent);
    if (!validation.valid) {
      throw new Error(validation.message);
    }

    // Parse responses from HTML
    const parsedResponses = parseResponseSheetHTML(htmlContent);
    if (parsedResponses.length === 0) {
      throw new Error("Could not parse any responses from the file. Please ensure this is a valid JEE response sheet.");
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

    try {
      // Try to fetch via edge function
      const { data, error: fetchError } = await supabase.functions.invoke("fetch-response-sheet", {
        body: { url: url.trim() },
      });

      if (fetchError || !data?.success) {
        // Show fallback message
        setShowUploadFallback(true);
        setInputMethod("html");
        setError("This link cannot be accessed automatically (login/session required). Please upload the Response HTML file.");
        setLoading(false);
        return;
      }

      const submissionId = await processAnalysis(data.html, "url");
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

    try {
      const htmlContent = await file.text();
      const submissionId = await processAnalysis(htmlContent, "html");
      
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

  const formatExamDate = (dateStr: string) => {
    try {
      return format(new Date(dateStr), "d MMMM yyyy");
    } catch {
      return dateStr;
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
                  {/* Exam Date Dropdown */}
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
                        {examDates.length === 0 ? (
                          <SelectItem value="none" disabled>
                            No exam dates available
                          </SelectItem>
                        ) : (
                          examDates.map((date) => (
                            <SelectItem key={date} value={date}>
                              {formatExamDate(date)}
                            </SelectItem>
                          ))
                        )}
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

                {/* Error Message */}
                {error && (
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
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
