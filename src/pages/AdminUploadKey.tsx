import { useState, useEffect } from "react";
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
import { ArrowLeft, Upload, Loader2, AlertCircle, CheckCircle, FileText, LogOut } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Test } from "@/lib/types";
import { useToast } from "@/hooks/use-toast";

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

const AdminUploadKey = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { toast } = useToast();

  const [tests, setTests] = useState<Test[]>([]);
  const [selectedTestId, setSelectedTestId] = useState(searchParams.get("testId") || "");
  const [csvContent, setCsvContent] = useState("");
  const [loading, setLoading] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [parsedKeys, setParsedKeys] = useState<ParsedKey[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    checkAuth();
    fetchTests();
  }, []);

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
      .order("created_at", { ascending: false });

    if (data) {
      setTests(data as unknown as Test[]);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/admin");
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
        const validTypes = ["mcq_single", "msq", "numerical"];
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

  const handleUpload = async () => {
    if (!selectedTestId) {
      setError("Please select a test");
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
              {/* Test Selection */}
              <div className="space-y-2">
                <Label htmlFor="test">Select Test</Label>
                <Select value={selectedTestId} onValueChange={setSelectedTestId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a test..." />
                  </SelectTrigger>
                  <SelectContent>
                    {tests.map((test) => (
                      <SelectItem key={test.id} value={test.id}>
                        {test.name} – {test.shift}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
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
                  disabled={loading || parsedKeys.length === 0}
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
