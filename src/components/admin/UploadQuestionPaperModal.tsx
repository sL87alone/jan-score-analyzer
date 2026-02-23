import { useState, useCallback } from "react";
import JSZip from "jszip";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import {
  Upload,
  FileArchive,
  CheckCircle,
  XCircle,
  Loader2,
  Image as ImageIcon,
  AlertTriangle,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface ParsedImage {
  filename: string;
  path: string; // storage path like q1.jpg or q1-op1.jpg
  questionNumber: number;
  optionNumber?: number;
  data: string; // base64
}

interface ParsedZipResult {
  examDate: string;
  shift: string;
  totalQuestions: number;
  questionsWithAllOptions: number;
  images: ParsedImage[];
  errors: string[];
}

interface UploadQuestionPaperModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  test: {
    id: string;
    name: string;
    exam_date: string;
    shift: string;
  } | null;
  onSuccess: () => void;
}

// Regex: 21jan26-s1-q1.jpg or 21jan26-s1-q1-op1.jpg
const FILE_REGEX = /(\d{2}[a-z]{3}\d{2})-s(\d)-q(\d+)(?:-op(\d))?\.(?:jpg|jpeg|png|webp)/i;

function parseZipFilename(zipName: string): { examDate: string; shift: string } | null {
  const match = zipName.match(/(\d{2})([a-z]{3})(\d{2})-s(\d)/i);
  if (!match) return null;
  
  const day = match[1];
  const monthStr = match[2].toLowerCase();
  const year = `20${match[3]}`;
  const shift = `Shift ${match[4]}`;
  
  const months: Record<string, string> = {
    jan: "01", feb: "02", mar: "03", apr: "04", may: "05", jun: "06",
    jul: "07", aug: "08", sep: "09", oct: "10", nov: "11", dec: "12",
  };
  const month = months[monthStr];
  if (!month) return null;
  
  return { examDate: `${year}-${month}-${day}`, shift };
}

export const UploadQuestionPaperModal = ({
  open,
  onOpenChange,
  test,
  onSuccess,
}: UploadQuestionPaperModalProps) => {
  const { toast } = useToast();
  const [file, setFile] = useState<File | null>(null);
  const [parsing, setParsing] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [parseResult, setParseResult] = useState<ParsedZipResult | null>(null);

  const reset = () => {
    setFile(null);
    setParsing(false);
    setUploading(false);
    setUploadProgress(0);
    setParseResult(null);
  };

  const handleFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;
    
    if (!selectedFile.name.endsWith(".zip")) {
      toast({ title: "Invalid file", description: "Only .zip files are allowed.", variant: "destructive" });
      return;
    }

    setFile(selectedFile);
    setParsing(true);
    setParseResult(null);

    try {
      const zip = await JSZip.loadAsync(selectedFile);
      const images: ParsedImage[] = [];
      const errors: string[] = [];
      const questionNumbers = new Set<number>();

      // Parse ZIP filename for metadata
      const zipMeta = parseZipFilename(selectedFile.name);

      const entries = Object.entries(zip.files).filter(([_, f]) => !f.dir);

      for (const [filename, zipEntry] of entries) {
        // Get just the filename without directory
        const baseName = filename.split("/").pop() || filename;
        const match = baseName.match(FILE_REGEX);
        
        if (!match) {
          if (/\.(jpg|jpeg|png|webp)$/i.test(baseName)) {
            errors.push(`Skipped: "${baseName}" doesn't match naming format`);
          }
          continue;
        }

        const questionNumber = parseInt(match[3], 10);
        const optionNumber = match[4] ? parseInt(match[4], 10) : undefined;

        questionNumbers.add(questionNumber);

        // Read as base64
        const data = await zipEntry.async("base64");
        
        // Build storage path
        const storageName = optionNumber
          ? `q${questionNumber}-op${optionNumber}.jpg`
          : `q${questionNumber}.jpg`;

        images.push({
          filename: baseName,
          path: storageName,
          questionNumber,
          optionNumber,
          data,
        });
      }

      // Count questions with all 4 options
      const questionsWithAllOptions = [...questionNumbers].filter(qNum => {
        const opts = images.filter(i => i.questionNumber === qNum && i.optionNumber);
        return opts.length === 4;
      }).length;

      setParseResult({
        examDate: zipMeta?.examDate || test?.exam_date || "Unknown",
        shift: zipMeta?.shift || test?.shift || "Unknown",
        totalQuestions: questionNumbers.size,
        questionsWithAllOptions,
        images,
        errors,
      });
    } catch (err) {
      toast({ title: "Parse Error", description: "Failed to read ZIP file.", variant: "destructive" });
      console.error("ZIP parse error:", err);
    } finally {
      setParsing(false);
    }
  }, [test, toast]);

  const handleUpload = async () => {
    if (!parseResult || !test) return;

    setUploading(true);
    setUploadProgress(0);

    try {
      const token = getSessionToken();
      if (!token) throw new Error("Not authenticated");

      // Send images in batches to avoid payload limits
      const BATCH_SIZE = 10;
      const totalBatches = Math.ceil(parseResult.images.length / BATCH_SIZE);
      let totalUploaded = 0;

      // For first batch, we send all to let the edge function clear existing data
      // Then subsequent batches append
      for (let i = 0; i < parseResult.images.length; i += BATCH_SIZE) {
        const batch = parseResult.images.slice(i, i + BATCH_SIZE);
        
        const response = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/upload-question-paper`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
              apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
            },
            body: JSON.stringify({
              test_id: test.id,
              images: batch.map(img => ({
                path: img.path,
                data: img.data,
                question_number: img.questionNumber,
                option_number: img.optionNumber,
              })),
            }),
          }
        );

        if (!response.ok) {
          const result = await response.json();
          throw new Error(result.error || "Upload failed");
        }

        totalUploaded += batch.length;
        setUploadProgress(Math.round((totalUploaded / parseResult.images.length) * 100));
      }

      toast({
        title: "Upload Complete",
        description: `${parseResult.totalQuestions} questions uploaded successfully.`,
      });
      
      onSuccess();
      onOpenChange(false);
      reset();
    } catch (err) {
      console.error("Upload error:", err);
      toast({
        title: "Upload Failed",
        description: err instanceof Error ? err.message : "Failed to upload question paper.",
        variant: "destructive",
      });
    } finally {
      setUploading(false);
    }
  };

  const getSessionToken = (): string | null => {
    const stored = localStorage.getItem("admin_session");
    if (!stored) return null;
    try {
      return JSON.parse(stored).sessionToken || null;
    } catch {
      return null;
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!uploading) { onOpenChange(o); if (!o) reset(); } }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileArchive className="w-5 h-5" />
            Upload Question Paper
          </DialogTitle>
          <DialogDescription>
            {test ? `${test.name} — ${test.shift}` : "Select a test first"}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* File Input */}
          <div className="space-y-2">
            <Label>ZIP File</Label>
            <div className="flex items-center gap-2">
              <Input
                type="file"
                accept=".zip"
                onChange={handleFileSelect}
                disabled={parsing || uploading}
                className="flex-1"
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Format: <code className="bg-muted px-1 rounded">21jan26-s1p.zip</code> containing <code className="bg-muted px-1 rounded">21jan26-s1-q1.jpg</code>, <code className="bg-muted px-1 rounded">21jan26-s1-q1-op1.jpg</code>
            </p>
          </div>

          {/* Parsing indicator */}
          {parsing && (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span className="text-sm">Parsing ZIP file...</span>
            </div>
          )}

          {/* Parse Results */}
          {parseResult && (
            <div className="space-y-3 p-4 rounded-lg bg-muted/50 border">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-muted-foreground">Exam Date</p>
                  <p className="font-medium">{parseResult.examDate}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Shift</p>
                  <p className="font-medium">{parseResult.shift}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Questions Found</p>
                  <p className="font-medium flex items-center gap-1">
                    <ImageIcon className="w-4 h-4" />
                    {parseResult.totalQuestions}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">With All 4 Options</p>
                  <p className="font-medium flex items-center gap-1">
                    {parseResult.questionsWithAllOptions === parseResult.totalQuestions ? (
                      <CheckCircle className="w-4 h-4 text-success" />
                    ) : (
                      <AlertTriangle className="w-4 h-4 text-warning" />
                    )}
                    {parseResult.questionsWithAllOptions}/{parseResult.totalQuestions}
                  </p>
                </div>
              </div>

              <div className="text-sm">
                <p className="text-muted-foreground">Total Images</p>
                <p className="font-medium">{parseResult.images.length} files ready to upload</p>
              </div>

              {parseResult.errors.length > 0 && (
                <div className="space-y-1">
                  <p className="text-sm font-medium text-warning flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3" />
                    Warnings ({parseResult.errors.length})
                  </p>
                  <div className="max-h-24 overflow-y-auto text-xs text-muted-foreground space-y-0.5">
                    {parseResult.errors.map((err, i) => (
                      <p key={i}>• {err}</p>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Upload Progress */}
          {uploading && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Uploading...</span>
                <span className="font-mono">{uploadProgress}%</span>
              </div>
              <Progress value={uploadProgress} />
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => { onOpenChange(false); reset(); }}
            disabled={uploading}
          >
            Cancel
          </Button>
          <Button
            onClick={handleUpload}
            disabled={!parseResult || parseResult.images.length === 0 || uploading || parsing}
          >
            {uploading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Uploading...
              </>
            ) : (
              <>
                <Upload className="w-4 h-4 mr-2" />
                Process & Save
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
