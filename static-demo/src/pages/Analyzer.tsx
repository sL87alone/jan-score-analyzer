 import { useState, useRef } from "react";
 import { Upload, Link as LinkIcon, FileText, Calendar, Clock, ArrowRight, Loader2 } from "lucide-react";
 import { Button } from "../components/Button";
 import { Card, CardContent } from "../components/Card";
 import { ResultData } from "../App";
 import { parseResponseSheet } from "../lib/parser";
 import { calculateScore } from "../lib/scoring";
 import { estimatePercentile } from "../lib/percentile";
 
 interface AnalyzerProps {
   onNavigate: (route: "home" | "analyze" | "result", data?: ResultData) => void;
   onResult: (data: ResultData) => void;
 }
 
 const examDates = [
   { value: "2026-01-22", label: "22 Jan 2026" },
   { value: "2026-01-23", label: "23 Jan 2026" },
   { value: "2026-01-24", label: "24 Jan 2026" },
   { value: "2026-01-28", label: "28 Jan 2026" },
   { value: "2026-01-29", label: "29 Jan 2026" },
 ];
 
 const shifts = [
   { value: "S1", label: "Shift 1 (Morning)" },
   { value: "S2", label: "Shift 2 (Afternoon)" },
 ];
 
 export function Analyzer({ onNavigate, onResult }: AnalyzerProps) {
   const [inputMethod, setInputMethod] = useState<"url" | "file">("url");
   const [url, setUrl] = useState("");
   const [file, setFile] = useState<File | null>(null);
   const [examDate, setExamDate] = useState("");
   const [shift, setShift] = useState("");
   const [loading, setLoading] = useState(false);
   const [error, setError] = useState("");
   const fileInputRef = useRef<HTMLInputElement>(null);
 
   const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
     const selectedFile = e.target.files?.[0];
     if (selectedFile) {
       setFile(selectedFile);
       setError("");
     }
   };
 
   const handleAnalyze = async () => {
     setError("");
     
     if (!examDate || !shift) {
       setError("Please select exam date and shift");
       return;
     }
 
     if (inputMethod === "url" && !url) {
       setError("Please enter a response sheet URL");
       return;
     }
 
     if (inputMethod === "file" && !file) {
       setError("Please upload a response sheet file");
       return;
     }
 
     setLoading(true);
 
     try {
       let htmlContent = "";
 
       if (inputMethod === "file" && file) {
         htmlContent = await file.text();
       } else if (inputMethod === "url") {
         // For demo, we'll simulate parsing
         // In production, this would fetch the URL content
         setError("URL fetching requires a backend. Please use file upload for the demo.");
         setLoading(false);
         return;
       }
 
       const responses = parseResponseSheet(htmlContent);
       
       if (responses.length === 0) {
         setError("Could not parse any responses from the file. Please check the file format.");
         setLoading(false);
         return;
       }
 
       const scoreResult = calculateScore(responses);
       const percentile = estimatePercentile(scoreResult.totalMarks, examDate, shift);
 
       const resultData: ResultData = {
         totalMarks: scoreResult.totalMarks,
         totalCorrect: scoreResult.totalCorrect,
         totalWrong: scoreResult.totalWrong,
         totalUnattempted: scoreResult.totalUnattempted,
         accuracy: scoreResult.accuracy,
         negativeMarks: scoreResult.negativeMarks,
         mathMarks: scoreResult.mathMarks,
         physicsMarks: scoreResult.physicsMarks,
         chemistryMarks: scoreResult.chemistryMarks,
         examDate,
         shift,
         percentile,
       };
 
       onResult(resultData);
       onNavigate("result", resultData);
     } catch (err) {
       console.error("Analysis error:", err);
       setError("Failed to analyze the response sheet. Please check the file format.");
     } finally {
       setLoading(false);
     }
   };
 
   return (
     <div className="min-h-screen pt-24 pb-12 px-4">
       <div className="container mx-auto max-w-2xl">
         <div className="text-center mb-8">
           <h1 className="text-3xl md:text-4xl font-bold mb-3">Analyze Your Response</h1>
           <p className="text-muted-foreground">
             Upload your JEE Main response sheet to get your score analysis
           </p>
         </div>
 
         <Card>
           <CardContent>
             {/* Input Method Toggle */}
             <div className="flex gap-2 mb-6">
               <button
                 onClick={() => setInputMethod("url")}
                 className={`flex-1 py-3 px-4 rounded-lg border text-sm font-medium transition-colors ${
                   inputMethod === "url"
                     ? "bg-primary text-primary-foreground border-primary"
                     : "bg-background hover:bg-muted"
                 }`}
               >
                 <LinkIcon className="w-4 h-4 inline mr-2" />
                 Paste URL
               </button>
               <button
                 onClick={() => setInputMethod("file")}
                 className={`flex-1 py-3 px-4 rounded-lg border text-sm font-medium transition-colors ${
                   inputMethod === "file"
                     ? "bg-primary text-primary-foreground border-primary"
                     : "bg-background hover:bg-muted"
                 }`}
               >
                 <Upload className="w-4 h-4 inline mr-2" />
                 Upload File
               </button>
             </div>
 
             {/* URL Input */}
             {inputMethod === "url" && (
               <div className="mb-6">
                 <label className="block text-sm font-medium mb-2">Response Sheet URL</label>
                 <input
                   type="url"
                   value={url}
                   onChange={(e) => setUrl(e.target.value)}
                   placeholder="https://cdndigialm.examgoal.net/..."
                   className="w-full px-4 py-3 rounded-lg border bg-background focus:ring-2 focus:ring-ring focus:border-primary outline-none transition-colors"
                 />
                 <p className="text-xs text-muted-foreground mt-2">
                   Note: URL fetching requires backend. Use file upload for this demo.
                 </p>
               </div>
             )}
 
             {/* File Upload */}
             {inputMethod === "file" && (
               <div className="mb-6">
                 <label className="block text-sm font-medium mb-2">Upload HTML File</label>
                 <div
                   onClick={() => fileInputRef.current?.click()}
                   className="border-2 border-dashed rounded-lg p-8 text-center cursor-pointer hover:border-primary hover:bg-primary/5 transition-colors"
                 >
                   <input
                     ref={fileInputRef}
                     type="file"
                     accept=".html,.htm"
                     onChange={handleFileChange}
                     className="hidden"
                   />
                   {file ? (
                     <div className="flex items-center justify-center gap-2">
                       <FileText className="w-5 h-5 text-primary" />
                       <span className="font-medium">{file.name}</span>
                     </div>
                   ) : (
                     <>
                       <Upload className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
                       <p className="text-sm text-muted-foreground">
                         Click to upload or drag and drop
                       </p>
                       <p className="text-xs text-muted-foreground mt-1">HTML files only</p>
                     </>
                   )}
                 </div>
               </div>
             )}
 
             {/* Exam Date & Shift */}
             <div className="grid md:grid-cols-2 gap-4 mb-6">
               <div>
                 <label className="block text-sm font-medium mb-2">
                   <Calendar className="w-4 h-4 inline mr-1" />
                   Exam Date
                 </label>
                 <select
                   value={examDate}
                   onChange={(e) => setExamDate(e.target.value)}
                   className="w-full px-4 py-3 rounded-lg border bg-background focus:ring-2 focus:ring-ring focus:border-primary outline-none"
                 >
                   <option value="">Select date</option>
                   {examDates.map((d) => (
                     <option key={d.value} value={d.value}>
                       {d.label}
                     </option>
                   ))}
                 </select>
               </div>
               <div>
                 <label className="block text-sm font-medium mb-2">
                   <Clock className="w-4 h-4 inline mr-1" />
                   Shift
                 </label>
                 <select
                   value={shift}
                   onChange={(e) => setShift(e.target.value)}
                   className="w-full px-4 py-3 rounded-lg border bg-background focus:ring-2 focus:ring-ring focus:border-primary outline-none"
                 >
                   <option value="">Select shift</option>
                   {shifts.map((s) => (
                     <option key={s.value} value={s.value}>
                       {s.label}
                     </option>
                   ))}
                 </select>
               </div>
             </div>
 
             {/* Error Message */}
             {error && (
               <div className="mb-4 p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
                 {error}
               </div>
             )}
 
             {/* Analyze Button */}
             <Button
               size="lg"
               className="w-full glow-effect gap-2"
               onClick={handleAnalyze}
               disabled={loading}
             >
               {loading ? (
                 <>
                   <Loader2 className="w-5 h-5 animate-spin" />
                   Analyzing...
                 </>
               ) : (
                 <>
                   Analyze Response
                   <ArrowRight className="w-5 h-5" />
                 </>
               )}
             </Button>
           </CardContent>
         </Card>
 
         {/* Help Section */}
         <div className="mt-8 text-center">
           <p className="text-sm text-muted-foreground mb-2">How to get your response sheet?</p>
           <ol className="text-sm text-muted-foreground space-y-1">
             <li>1. Login to NTA JEE Main portal</li>
             <li>2. Go to "View Response Sheet"</li>
             <li>3. Save the page as HTML file (Ctrl+S)</li>
             <li>4. Upload the saved file here</li>
           </ol>
         </div>
       </div>
     </div>
   );
 }