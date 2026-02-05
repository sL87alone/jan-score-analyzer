 import { CheckCircle, XCircle, MinusCircle, Target, TrendingUp, ArrowLeft, Download } from "lucide-react";
 import { Button } from "../components/Button";
 import { Card, CardContent } from "../components/Card";
 import { ResultData } from "../App";
 
 interface ResultProps {
   data: ResultData | null;
   onNavigate: (route: "home" | "analyze" | "result") => void;
 }
 
 export function Result({ data, onNavigate }: ResultProps) {
   if (!data) {
     return (
       <div className="min-h-screen pt-24 pb-12 px-4 flex items-center justify-center">
         <div className="text-center">
           <p className="text-muted-foreground mb-4">No result data available</p>
           <Button onClick={() => onNavigate("analyze")}>
             <ArrowLeft className="w-4 h-4 mr-2" />
             Go to Analyzer
           </Button>
         </div>
       </div>
     );
   }
 
   const formatDate = (dateStr: string) => {
     const date = new Date(dateStr);
     return date.toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" });
   };
 
   const getShiftLabel = (shift: string) => {
     return shift === "S1" ? "Shift 1" : "Shift 2";
   };
 
   return (
     <div className="min-h-screen pt-24 pb-12 px-4">
       <div className="container mx-auto max-w-5xl">
         {/* Back Button */}
         <button
           onClick={() => onNavigate("analyze")}
           className="flex items-center gap-2 text-muted-foreground hover:text-foreground mb-6 transition-colors"
         >
           <ArrowLeft className="w-4 h-4" />
           Analyze Another
         </button>
 
         {/* Exam Info */}
         <div className="flex flex-wrap items-center gap-4 mb-6 p-4 rounded-lg bg-muted/50 border">
           <span className="text-sm">
             <strong>Exam Date:</strong> {formatDate(data.examDate)}
           </span>
           <span className="text-sm">
             <strong>Shift:</strong> {getShiftLabel(data.shift)}
           </span>
         </div>
 
         {/* Score Card + Percentile */}
         <div className="grid md:grid-cols-3 gap-6 mb-8">
           {/* Main Score Card */}
           <div className="md:col-span-2 score-card">
             <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
               <div>
                 <p className="text-white/70 text-sm mb-1">Total Score</p>
                 <div className="flex items-baseline gap-2">
                   <span className="text-5xl md:text-6xl font-mono font-bold">{data.totalMarks}</span>
                   <span className="text-2xl text-white/70">/300</span>
                 </div>
               </div>
               <div className="grid grid-cols-3 gap-4 md:gap-8 text-center">
                 <div>
                   <p className="text-3xl font-mono font-bold">
                     {data.totalCorrect + data.totalWrong}
                   </p>
                   <p className="text-white/70 text-sm">Attempted</p>
                 </div>
                 <div>
                   <p className="text-3xl font-mono font-bold">{data.accuracy}%</p>
                   <p className="text-white/70 text-sm">Accuracy</p>
                 </div>
                 <div>
                   <p className="text-3xl font-mono font-bold text-red-300">-{data.negativeMarks}</p>
                   <p className="text-white/70 text-sm">Negative</p>
                 </div>
               </div>
             </div>
           </div>
 
           {/* Percentile Card */}
           <Card className="border-primary/20 bg-primary/5">
             <CardContent className="flex flex-col items-center justify-center h-full text-center">
               <TrendingUp className="w-8 h-8 text-primary mb-2" />
               <p className="text-sm text-muted-foreground mb-1">Expected Percentile</p>
               <p className="text-4xl font-mono font-bold text-primary">{data.percentile}</p>
               <p className="text-xs text-muted-foreground mt-2">Based on previous trends</p>
             </CardContent>
           </Card>
         </div>
 
         {/* Stats Row */}
         <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
           <Card>
             <CardContent className="pt-4">
               <div className="flex items-center gap-2">
                 <CheckCircle className="w-5 h-5 text-success" />
                 <span className="text-2xl font-mono font-bold">{data.totalCorrect}</span>
               </div>
               <p className="text-sm text-muted-foreground">Correct</p>
             </CardContent>
           </Card>
           <Card>
             <CardContent className="pt-4">
               <div className="flex items-center gap-2">
                 <XCircle className="w-5 h-5 text-destructive" />
                 <span className="text-2xl font-mono font-bold">{data.totalWrong}</span>
               </div>
               <p className="text-sm text-muted-foreground">Wrong</p>
             </CardContent>
           </Card>
           <Card>
             <CardContent className="pt-4">
               <div className="flex items-center gap-2">
                 <MinusCircle className="w-5 h-5 text-muted-foreground" />
                 <span className="text-2xl font-mono font-bold">{data.totalUnattempted}</span>
               </div>
               <p className="text-sm text-muted-foreground">Unattempted</p>
             </CardContent>
           </Card>
           <Card>
             <CardContent className="pt-4">
               <div className="flex items-center gap-2">
                 <Target className="w-5 h-5 text-primary" />
                 <span className="text-2xl font-mono font-bold">{data.accuracy}%</span>
               </div>
               <p className="text-sm text-muted-foreground">Accuracy</p>
             </CardContent>
           </Card>
         </div>
 
         {/* Subject Breakdown */}
         <Card className="mb-8">
           <CardContent>
             <h3 className="font-semibold text-lg mb-4">Subject-wise Breakdown</h3>
             <div className="grid grid-cols-3 gap-4 text-center">
               <div className="p-4 rounded-lg bg-muted/50">
                 <p className="text-2xl font-mono font-bold">{data.mathMarks}</p>
                 <p className="text-sm text-muted-foreground">Mathematics</p>
               </div>
               <div className="p-4 rounded-lg bg-muted/50">
                 <p className="text-2xl font-mono font-bold">{data.physicsMarks}</p>
                 <p className="text-sm text-muted-foreground">Physics</p>
               </div>
               <div className="p-4 rounded-lg bg-muted/50">
                 <p className="text-2xl font-mono font-bold">{data.chemistryMarks}</p>
                 <p className="text-sm text-muted-foreground">Chemistry</p>
               </div>
             </div>
           </CardContent>
         </Card>
 
         {/* Actions */}
         <div className="flex flex-wrap gap-4 justify-center">
           <Button onClick={() => onNavigate("analyze")} variant="outline" className="gap-2">
             <ArrowLeft className="w-4 h-4" />
             Analyze Another
           </Button>
           <Button
             onClick={() => window.print()}
             className="gap-2"
           >
             <Download className="w-4 h-4" />
             Print / Save PDF
           </Button>
         </div>
 
         {/* Disclaimer */}
         <p className="text-center text-xs text-muted-foreground mt-8">
           Disclaimer: This is an estimated score based on the response sheet analysis. 
           Final results depend on official NTA release.
         </p>
       </div>
     </div>
   );
 }