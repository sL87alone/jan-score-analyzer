import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { 
  Loader2, 
  AlertTriangle, 
  Calendar, 
  Clock, 
  FileText,
  RefreshCw,
  Upload,
  CheckCircle,
  XCircle,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { getExamDateLabel } from "@/lib/examDates";

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

interface TestInfo {
  id: string;
  name: string;
  exam_date: string;
  shift: string;
  key_count: number;
  updated_at: string;
}

interface UpdateKeysModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  test: TestInfo | null;
  onSuccess: () => void;
}

interface UpdateResult {
  mode: "replace" | "upsert";
  deletedCount?: number;
  insertedCount?: number;
  updatedCount?: number;
  totalKeys: number;
  breakdown: {
    mathematics: number;
    physics: number;
    chemistry: number;
  };
}

export function UpdateKeysModal({ open, onOpenChange, test, onSuccess }: UpdateKeysModalProps) {
  const { toast } = useToast();
  
  const [csvContent, setCsvContent] = useState("");
  const [updateMode, setUpdateMode] = useState<"replace" | "upsert">("replace");
  const [confirmed, setConfirmed] = useState(false);
  
  const [parsing, setParsing] = useState(false);
  const [parsedKeys, setParsedKeys] = useState<ParsedKey[]>([]);
  const [parseError, setParseError] = useState("");
  const [validationWarnings, setValidationWarnings] = useState<string[]>([]);
  
  const [uploading, setUploading] = useState(false);
  const [updateResult, setUpdateResult] = useState<UpdateResult | null>(null);

  // Reset state when modal opens/closes
  useEffect(() => {
    if (!open) {
      setCsvContent("");
      setUpdateMode("replace");
      setConfirmed(false);
      setParsedKeys([]);
      setParseError("");
      setValidationWarnings([]);
      setUpdateResult(null);
    }
  }, [open]);

  const parseCSV = () => {
    if (!csvContent.trim()) {
      setParseError("Please enter CSV content");
      return;
    }

    setParsing(true);
    setParseError("");
    setValidationWarnings([]);
    setParsedKeys([]);

    try {
      const lines = csvContent.trim().split("\n");
      const parsed: ParsedKey[] = [];
      const questionIds = new Set<string>();
      const duplicates: string[] = [];

      // Skip header if present
      const startIndex = lines[0].toLowerCase().includes("question") ? 1 : 0;

      for (let i = startIndex; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;

        const parts = line.split(",").map((p) => p.trim());

        if (parts.length < 4) {
          console.warn(`Skipping invalid line ${i + 1}: ${line}`);
          continue;
        }

        const questionId = parts[0];
        
        // Check for duplicates
        if (questionIds.has(questionId)) {
          duplicates.push(questionId);
        }
        questionIds.add(questionId);

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
          const numMatch = answer.match(/^(-?\d+\.?\d*)/);
          if (numMatch) {
            correctNumericValue = parseFloat(numMatch[1]);
          }
          const tolMatch = answer.match(/±(\d+\.?\d*)/);
          if (tolMatch) {
            numericTolerance = parseFloat(tolMatch[1]);
          }
        } else {
          correctOptionIds = answer.split(/[,\s]+/).filter(Boolean).map((o) => o.toUpperCase());
        }

        // Check for missing question_id
        if (!questionId) {
          setParseError(`Line ${i + 1}: Missing question_id`);
          setParsing(false);
          return;
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
        setParseError("No valid answer keys found in CSV");
        setParsing(false);
        return;
      }

      // Check for duplicates
      if (duplicates.length > 0) {
        setParseError(`Duplicate question_ids found: ${duplicates.slice(0, 5).join(", ")}${duplicates.length > 5 ? ` (+${duplicates.length - 5} more)` : ""}`);
        setParsing(false);
        return;
      }

      // Validation warnings
      const warnings: string[] = [];
      
      if (parsed.length !== 75) {
        warnings.push(`Expected 75 keys but found ${parsed.length}. This may be intentional.`);
      }

      const mathCount = parsed.filter(k => k.subject === "Mathematics").length;
      const physicsCount = parsed.filter(k => k.subject === "Physics").length;
      const chemistryCount = parsed.filter(k => k.subject === "Chemistry").length;

      if (mathCount !== 25 && mathCount > 0) {
        warnings.push(`Mathematics: ${mathCount} keys (expected 25)`);
      }
      if (physicsCount !== 25 && physicsCount > 0) {
        warnings.push(`Physics: ${physicsCount} keys (expected 25)`);
      }
      if (chemistryCount !== 25 && chemistryCount > 0) {
        warnings.push(`Chemistry: ${chemistryCount} keys (expected 25)`);
      }

      setValidationWarnings(warnings);
      setParsedKeys(parsed);
      
      toast({
        title: "CSV Parsed Successfully",
        description: `Found ${parsed.length} keys (M:${mathCount} P:${physicsCount} C:${chemistryCount})`,
      });
    } catch (err) {
      setParseError("Failed to parse CSV. Please check the format.");
    } finally {
      setParsing(false);
    }
  };

  const handleUpdate = async () => {
    if (!test || parsedKeys.length === 0) return;

    setUploading(true);
    setParseError("");

    try {
      // Get admin session token
      const stored = localStorage.getItem("admin_session");
      if (!stored) {
        throw new Error("Admin session not found. Please log in again.");
      }
      const { sessionToken } = JSON.parse(stored);

      // Prepare keys payload
      const keysPayload = parsedKeys.map((key) => ({
        question_id: key.question_id,
        subject: key.subject,
        question_type: key.question_type,
        correct_option_ids: key.correct_option_ids,
        correct_numeric_value: key.correct_numeric_value,
        numeric_tolerance: key.numeric_tolerance,
        is_cancelled: key.is_cancelled,
        is_bonus: key.is_bonus,
      }));

      // Call the edge function with update mode
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/upload-answer-keys`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${sessionToken}`,
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
          body: JSON.stringify({
            exam_date: test.exam_date,
            shift: test.shift,
            keys: keysPayload,
            mode: updateMode, // "replace" or "upsert"
          }),
        }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Update failed");
      }

      setUpdateResult({
        mode: updateMode,
        deletedCount: result.deletedCount,
        insertedCount: result.insertedCount,
        updatedCount: result.updatedCount,
        totalKeys: result.totalKeys,
        breakdown: result.breakdown,
      });

      toast({
        title: "Keys Updated Successfully!",
        description: `${updateMode === "replace" ? "Replaced" : "Merged"} keys. Total: ${result.totalKeys} (M:${result.breakdown.mathematics} P:${result.breakdown.physics} C:${result.breakdown.chemistry})`,
      });

      // Signal tests page to refresh
      localStorage.setItem("tests_refresh_needed", Date.now().toString());
      
      // Call success callback
      onSuccess();
      
      // Close modal after short delay to show result
      setTimeout(() => {
        onOpenChange(false);
      }, 1500);
    } catch (err) {
      console.error("Update error:", err);
      setParseError(`Failed to update: ${err instanceof Error ? err.message : "Unknown error"}`);
    } finally {
      setUploading(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        setCsvContent(event.target?.result as string);
        setParsedKeys([]);
        setParseError("");
      };
      reader.readAsText(file);
    }
  };

  if (!test) return null;

  const isReadyToUpdate = parsedKeys.length > 0 && confirmed && !uploading;
  
  // Diff summary
  const getDiffSummary = () => {
    if (parsedKeys.length === 0) return null;
    
    const existingCount = test.key_count || 0;
    const newCount = parsedKeys.length;
    
    if (updateMode === "replace") {
      return (
        <div className="text-sm space-y-1">
          <p className="flex items-center gap-2">
            <XCircle className="w-4 h-4 text-destructive" />
            Will delete: <strong>{existingCount}</strong> existing keys
          </p>
          <p className="flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-primary" />
            Will insert: <strong>{newCount}</strong> new keys
          </p>
        </div>
      );
    } else {
      return (
        <div className="text-sm space-y-1">
          <p className="flex items-center gap-2">
            <RefreshCw className="w-4 h-4 text-amber-500" />
            Will update existing question_ids if found
          </p>
          <p className="flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-primary" />
            Will insert new question_ids: <strong>{newCount}</strong> total keys in CSV
          </p>
        </div>
      );
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <RefreshCw className="w-5 h-5" />
            Update Answer Keys
          </DialogTitle>
          <DialogDescription>
            Update existing answer keys for this test shift
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Test Info (Read-only) */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label className="text-muted-foreground text-xs">Exam Date</Label>
              <div className="flex items-center gap-2 p-2 bg-muted rounded-md">
                <Calendar className="w-4 h-4 text-muted-foreground" />
                <span className="font-medium">{getExamDateLabel(test.exam_date)}</span>
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-muted-foreground text-xs">Shift</Label>
              <div className="flex items-center gap-2 p-2 bg-muted rounded-md">
                <Clock className="w-4 h-4 text-muted-foreground" />
                <span className="font-medium">{test.shift}</span>
              </div>
            </div>
          </div>

          {/* Current Stats */}
          <div className="p-3 bg-muted/50 rounded-md">
            <Label className="text-muted-foreground text-xs">Current Status</Label>
            <div className="flex items-center gap-4 mt-1">
              <Badge variant={test.key_count >= 75 ? "default" : test.key_count > 0 ? "secondary" : "destructive"}>
                {test.key_count} keys
              </Badge>
              <span className="text-sm text-muted-foreground">
                Last updated: {new Date(test.updated_at).toLocaleString()}
              </span>
            </div>
          </div>

          <Separator />

          {/* Update Mode Selection */}
          <div className="space-y-3">
            <Label>Update Mode</Label>
            <RadioGroup value={updateMode} onValueChange={(v) => setUpdateMode(v as "replace" | "upsert")}>
              <div className="flex items-start gap-3 p-3 border rounded-md hover:bg-muted/50 cursor-pointer" onClick={() => setUpdateMode("replace")}>
                <RadioGroupItem value="replace" id="replace" className="mt-0.5" />
                <div className="space-y-1">
                  <Label htmlFor="replace" className="font-medium cursor-pointer">
                    Replace (Recommended)
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    Delete all existing keys for this shift, then insert new keys. Clean slate approach.
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3 p-3 border rounded-md hover:bg-muted/50 cursor-pointer" onClick={() => setUpdateMode("upsert")}>
                <RadioGroupItem value="upsert" id="upsert" className="mt-0.5" />
                <div className="space-y-1">
                  <Label htmlFor="upsert" className="font-medium cursor-pointer">
                    Merge / Upsert
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    Update existing question_id rows, insert new ones. Does not delete unmentioned keys.
                  </p>
                </div>
              </div>
            </RadioGroup>
          </div>

          <Separator />

          {/* CSV Input */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>CSV Content</Label>
              <div className="flex items-center gap-2">
                <input
                  type="file"
                  accept=".csv,.txt"
                  onChange={handleFileUpload}
                  className="hidden"
                  id="csv-file-update"
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => document.getElementById("csv-file-update")?.click()}
                >
                  <Upload className="w-4 h-4 mr-1" />
                  Upload File
                </Button>
              </div>
            </div>
            <Textarea
              placeholder="question_id,subject,type,answer,is_cancelled,is_bonus
1,Mathematics,mcq_single,A,false,false
2,Physics,numerical,3.14,false,false"
              value={csvContent}
              onChange={(e) => {
                setCsvContent(e.target.value);
                setParsedKeys([]);
                setParseError("");
              }}
              className="font-mono text-sm min-h-[120px]"
            />
            <Button 
              onClick={parseCSV} 
              disabled={parsing || !csvContent.trim()}
              className="w-full"
              variant="secondary"
            >
              {parsing ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Parsing...
                </>
              ) : (
                <>
                  <FileText className="w-4 h-4 mr-2" />
                  Parse CSV
                </>
              )}
            </Button>
          </div>

          {/* Parse Error */}
          {parseError && (
            <Alert variant="destructive">
              <AlertTriangle className="w-4 h-4" />
              <AlertDescription>{parseError}</AlertDescription>
            </Alert>
          )}

          {/* Validation Warnings */}
          {validationWarnings.length > 0 && (
            <Alert>
              <AlertTriangle className="w-4 h-4" />
              <AlertDescription>
                <ul className="list-disc list-inside space-y-1">
                  {validationWarnings.map((warning, i) => (
                    <li key={i}>{warning}</li>
                  ))}
                </ul>
              </AlertDescription>
            </Alert>
          )}

          {/* Parsed Keys Summary */}
          {parsedKeys.length > 0 && (
            <div className="p-3 bg-primary/10 rounded-md space-y-3">
              <div className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-primary" />
                <span className="font-medium">Parsed {parsedKeys.length} keys</span>
              </div>
              <div className="flex gap-2">
                <Badge variant="outline">
                  Math: {parsedKeys.filter(k => k.subject === "Mathematics").length}
                </Badge>
                <Badge variant="outline">
                  Physics: {parsedKeys.filter(k => k.subject === "Physics").length}
                </Badge>
                <Badge variant="outline">
                  Chemistry: {parsedKeys.filter(k => k.subject === "Chemistry").length}
                </Badge>
              </div>
              
              {/* Diff Summary */}
              <Separator />
              {getDiffSummary()}
            </div>
          )}

          {/* Confirmation Checkbox */}
          {parsedKeys.length > 0 && (
            <div className="flex items-start gap-3 p-3 border border-amber-500/50 bg-amber-500/10 rounded-md">
              <Checkbox
                id="confirm"
                checked={confirmed}
                onCheckedChange={(checked) => setConfirmed(checked === true)}
              />
              <div className="space-y-1">
                <Label htmlFor="confirm" className="font-medium cursor-pointer">
                  I understand this will affect existing student reports
                </Label>
                <p className="text-sm text-muted-foreground">
                  Updating answer keys may change scores for students who already analyzed this shift.
                </p>
              </div>
            </div>
          )}

          {/* Update Result */}
          {updateResult && (
            <Alert className="border-primary bg-primary/10">
              <CheckCircle className="w-4 h-4 text-primary" />
              <AlertDescription>
                <p className="font-medium">Update Complete!</p>
                <p className="text-sm">
                  {updateResult.mode === "replace" 
                    ? `Replaced ${updateResult.deletedCount || 0} keys with ${updateResult.insertedCount || parsedKeys.length} new keys.`
                    : `Upserted ${updateResult.totalKeys} keys.`
                  }
                </p>
                <p className="text-sm text-muted-foreground">
                  Total: {updateResult.totalKeys} (M:{updateResult.breakdown.mathematics} P:{updateResult.breakdown.physics} C:{updateResult.breakdown.chemistry})
                </p>
              </AlertDescription>
            </Alert>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button 
            onClick={handleUpdate} 
            disabled={!isReadyToUpdate}
          >
            {uploading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Updating...
              </>
            ) : (
              <>
                <RefreshCw className="w-4 h-4 mr-2" />
                Update Keys
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
