 import { useState, useMemo } from "react";
 import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
 import { Badge } from "@/components/ui/badge";
 import { Button } from "@/components/ui/button";
 import { Input } from "@/components/ui/input";
 import {
   Select,
   SelectContent,
   SelectItem,
   SelectTrigger,
   SelectValue,
 } from "@/components/ui/select";
 import {
   Tooltip,
   TooltipContent,
   TooltipProvider,
   TooltipTrigger,
 } from "@/components/ui/tooltip";
 import {
   Collapsible,
   CollapsibleContent,
   CollapsibleTrigger,
 } from "@/components/ui/collapsible";
 import {
   CheckCircle,
   XCircle,
   MinusCircle,
   Search,
   Info,
   ChevronDown,
   ChevronUp,
   Filter,
 } from "lucide-react";
 import { QuestionResult } from "@/lib/questionParser";
 import { cn } from "@/lib/utils";
 
 interface QuestionAnalysisProps {
   questionResults: QuestionResult[];
 }
 
 type StatusFilter = "all" | "correct" | "wrong" | "unattempted";
 type SubjectFilter = "all" | "Mathematics" | "Physics" | "Chemistry";
 type SectionFilter = "all" | "A" | "B";
 
 export const QuestionAnalysis = ({ questionResults }: QuestionAnalysisProps) => {
   const [subjectFilter, setSubjectFilter] = useState<SubjectFilter>("all");
   const [sectionFilter, setSectionFilter] = useState<SectionFilter>("all");
   const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
   const [searchQuery, setSearchQuery] = useState("");
   const [expandedQuestions, setExpandedQuestions] = useState<Set<string>>(new Set());
   const [showAllExpanded, setShowAllExpanded] = useState(false);
 
   const filteredQuestions = useMemo(() => {
     return questionResults.filter(q => {
       // Subject filter
       if (subjectFilter !== "all" && q.subject !== subjectFilter) return false;
       
       // Section filter
       if (sectionFilter !== "all" && q.section !== sectionFilter) return false;
       
       // Status filter
       if (statusFilter === "correct" && !q.is_correct) return false;
       if (statusFilter === "wrong" && (q.is_correct || !q.attempted)) return false;
       if (statusFilter === "unattempted" && q.attempted) return false;
       
       // Search by question number
       if (searchQuery) {
         const searchNum = parseInt(searchQuery, 10);
         if (!isNaN(searchNum) && q.qno !== searchNum) return false;
         if (isNaN(searchNum) && !q.question_id.includes(searchQuery)) return false;
       }
       
       return true;
     });
   }, [questionResults, subjectFilter, sectionFilter, statusFilter, searchQuery]);
 
   const toggleExpand = (id: string) => {
     const newExpanded = new Set(expandedQuestions);
     if (newExpanded.has(id)) {
       newExpanded.delete(id);
     } else {
       newExpanded.add(id);
     }
     setExpandedQuestions(newExpanded);
   };
 
   const toggleAllExpanded = () => {
     if (showAllExpanded) {
       setExpandedQuestions(new Set());
     } else {
       setExpandedQuestions(new Set(filteredQuestions.map(q => q.question_id)));
     }
     setShowAllExpanded(!showAllExpanded);
   };
 
   const getStatusIcon = (q: QuestionResult) => {
     if (!q.attempted) return <MinusCircle className="w-4 h-4 text-muted-foreground" />;
     if (q.is_correct) return <CheckCircle className="w-4 h-4 text-success" />;
     return <XCircle className="w-4 h-4 text-destructive" />;
   };
 
   const getStatusLabel = (q: QuestionResult) => {
     if (!q.attempted) return "Unattempted";
     if (q.is_correct) return "Correct";
     return "Wrong";
   };
 
   const getSubjectColor = (subject: string) => {
     switch (subject) {
       case "Mathematics": return "bg-math text-white";
       case "Physics": return "bg-physics text-white";
       case "Chemistry": return "bg-chemistry text-white";
       default: return "bg-muted";
     }
   };
 
   const getSectionLabel = (section: string) => {
     return section === "A" ? "MCQ" : "Numerical";
   };
 
   // Stats summary
   const stats = useMemo(() => {
     const correct = filteredQuestions.filter(q => q.is_correct).length;
     const wrong = filteredQuestions.filter(q => q.attempted && !q.is_correct).length;
     const unattempted = filteredQuestions.filter(q => !q.attempted).length;
     return { correct, wrong, unattempted, total: filteredQuestions.length };
   }, [filteredQuestions]);
 
   return (
     <Card>
       <CardHeader>
         <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
           <div className="flex items-center gap-2">
             <CardTitle>Question-wise Analysis</CardTitle>
             <TooltipProvider>
               <Tooltip>
                 <TooltipTrigger>
                   <Info className="w-4 h-4 text-muted-foreground" />
                 </TooltipTrigger>
                 <TooltipContent className="max-w-xs">
                   <div className="space-y-2 text-sm">
                     <p className="font-semibold">Marking Rules:</p>
                     <p>• Section A (MCQ): +4 correct, -1 wrong, 0 unattempted</p>
                     <p>• Section B (Numerical): +4 correct, 0 wrong/unattempted</p>
                   </div>
                 </TooltipContent>
               </Tooltip>
             </TooltipProvider>
           </div>
           <Button variant="outline" size="sm" onClick={toggleAllExpanded}>
             {showAllExpanded ? (
               <>
                 <ChevronUp className="w-4 h-4 mr-1" />
                 Collapse All
               </>
             ) : (
               <>
                 <ChevronDown className="w-4 h-4 mr-1" />
                 Expand All
               </>
             )}
           </Button>
         </div>
       </CardHeader>
       <CardContent className="space-y-4">
         {/* Filters */}
         <div className="flex flex-wrap gap-3 p-3 bg-muted/50 rounded-lg">
           <div className="flex items-center gap-2">
             <Filter className="w-4 h-4 text-muted-foreground" />
           </div>
           <Select value={subjectFilter} onValueChange={(v) => setSubjectFilter(v as SubjectFilter)}>
             <SelectTrigger className="w-[140px]">
               <SelectValue placeholder="Subject" />
             </SelectTrigger>
             <SelectContent>
               <SelectItem value="all">All Subjects</SelectItem>
               <SelectItem value="Mathematics">Mathematics</SelectItem>
               <SelectItem value="Physics">Physics</SelectItem>
               <SelectItem value="Chemistry">Chemistry</SelectItem>
             </SelectContent>
           </Select>
           
           <Select value={sectionFilter} onValueChange={(v) => setSectionFilter(v as SectionFilter)}>
             <SelectTrigger className="w-[130px]">
               <SelectValue placeholder="Section" />
             </SelectTrigger>
             <SelectContent>
               <SelectItem value="all">All Sections</SelectItem>
               <SelectItem value="A">Section A (MCQ)</SelectItem>
               <SelectItem value="B">Section B (Num)</SelectItem>
             </SelectContent>
           </Select>
           
           <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as StatusFilter)}>
             <SelectTrigger className="w-[130px]">
               <SelectValue placeholder="Status" />
             </SelectTrigger>
             <SelectContent>
               <SelectItem value="all">All Status</SelectItem>
               <SelectItem value="correct">Correct</SelectItem>
               <SelectItem value="wrong">Wrong</SelectItem>
               <SelectItem value="unattempted">Unattempted</SelectItem>
             </SelectContent>
           </Select>
           
           <div className="relative flex-1 min-w-[150px]">
             <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
             <Input
               placeholder="Q# or ID"
               value={searchQuery}
               onChange={(e) => setSearchQuery(e.target.value)}
               className="pl-8"
             />
           </div>
         </div>
 
         {/* Stats summary */}
         <div className="flex flex-wrap gap-3 text-sm">
           <span className="text-muted-foreground">Showing {stats.total} questions:</span>
           <span className="flex items-center gap-1 text-success">
             <CheckCircle className="w-3 h-3" /> {stats.correct} correct
           </span>
           <span className="flex items-center gap-1 text-destructive">
             <XCircle className="w-3 h-3" /> {stats.wrong} wrong
           </span>
           <span className="flex items-center gap-1 text-muted-foreground">
             <MinusCircle className="w-3 h-3" /> {stats.unattempted} unattempted
           </span>
         </div>
 
         {/* Question cards */}
         <div className="space-y-3 max-h-[600px] overflow-y-auto pr-2">
           {filteredQuestions.length === 0 ? (
             <div className="text-center py-8 text-muted-foreground">
               No questions match the current filters
             </div>
           ) : (
             filteredQuestions.map(q => (
               <Collapsible
                 key={q.question_id}
                 open={expandedQuestions.has(q.question_id)}
                 onOpenChange={() => toggleExpand(q.question_id)}
               >
                 <div className={cn(
                   "border rounded-lg overflow-hidden transition-colors",
                   q.is_correct && q.attempted ? "border-success/30" : "",
                   !q.is_correct && q.attempted ? "border-destructive/30" : ""
                 )}>
                   {/* Header */}
                   <CollapsibleTrigger className="w-full p-3 flex items-center gap-3 hover:bg-muted/50 transition-colors">
                     <div className="flex items-center gap-2 flex-1">
                       {getStatusIcon(q)}
                       <span className="font-mono font-semibold">Q{q.qno}</span>
                       <Badge className={cn("text-xs", getSubjectColor(q.subject))}>
                         {q.subject.slice(0, 4)}
                       </Badge>
                       <Badge variant="outline" className="text-xs">
                         Sec {q.section} ({getSectionLabel(q.section)})
                       </Badge>
                       <Badge 
                         variant="outline" 
                         className={cn(
                           "text-xs ml-auto",
                           q.is_correct && q.attempted ? "border-success text-success" : "",
                           !q.is_correct && q.attempted ? "border-destructive text-destructive" : ""
                         )}
                       >
                         {q.marks_awarded > 0 ? `+${q.marks_awarded}` : q.marks_awarded}
                       </Badge>
                     </div>
                     <ChevronDown className={cn(
                       "w-4 h-4 transition-transform",
                       expandedQuestions.has(q.question_id) ? "rotate-180" : ""
                     )} />
                   </CollapsibleTrigger>
 
                   {/* Expanded content */}
                   <CollapsibleContent>
                     <div className="p-3 pt-0 space-y-3 border-t bg-muted/20">
                       {/* Question text */}
                       {q.question_text && q.question_text !== `Question ${q.qno}` && (
                         <p className="text-sm text-muted-foreground line-clamp-3">
                           {q.question_text}
                         </p>
                       )}
 
                       {/* MCQ Options */}
                       {q.options.length > 0 && (
                         <div className="space-y-2">
                           {q.options.map(opt => {
                             const isUserSelected = String(q.user_answer) === opt.id;
                             const isCorrect = String(q.correct_answer) === opt.id;
                             
                             return (
                               <div
                                 key={opt.id}
                                 className={cn(
                                   "flex items-center gap-2 p-2 rounded border text-sm",
                                   isCorrect ? "bg-success/10 border-success" : "",
                                   isUserSelected && !isCorrect ? "bg-destructive/10 border-destructive" : "",
                                   !isCorrect && !isUserSelected ? "border-border" : ""
                                 )}
                               >
                                 <span className="font-mono w-6 text-center">{opt.label}.</span>
                                 <span className="flex-1">{opt.text || `Option ${opt.label}`}</span>
                                 {isCorrect && (
                                   <CheckCircle className="w-4 h-4 text-success" />
                                 )}
                                 {isUserSelected && !isCorrect && (
                                   <XCircle className="w-4 h-4 text-destructive" />
                                 )}
                               </div>
                             );
                           })}
                         </div>
                       )}
 
                       {/* Numerical answer */}
                       {q.section === "B" && (
                         <div className="grid grid-cols-2 gap-3 text-sm">
                           <div className="p-2 rounded bg-muted">
                             <p className="text-xs text-muted-foreground mb-1">Your Answer</p>
                             <p className={cn(
                               "font-mono font-semibold",
                               q.is_correct ? "text-success" : q.attempted ? "text-destructive" : "text-muted-foreground"
                             )}>
                               {q.user_answer !== null ? String(q.user_answer) : "Not answered"}
                             </p>
                           </div>
                           <div className="p-2 rounded bg-success/10">
                             <p className="text-xs text-muted-foreground mb-1">Correct Answer</p>
                             <p className="font-mono font-semibold text-success">
                               {q.correct_answer !== null ? String(q.correct_answer) : "N/A"}
                             </p>
                           </div>
                         </div>
                       )}
 
                       {/* Marks info */}
                       <div className="flex items-center gap-4 text-xs text-muted-foreground pt-2 border-t">
                         <span>Status: {getStatusLabel(q)}</span>
                         <span>
                           Marks: {q.marks_awarded > 0 ? `+${q.marks_awarded}` : q.marks_awarded}
                           {q.negative > 0 && ` (−${q.negative} negative)`}
                         </span>
                         <span className="font-mono text-xs">ID: {q.question_id}</span>
                       </div>
                     </div>
                   </CollapsibleContent>
                 </div>
               </Collapsible>
             ))
           )}
         </div>
       </CardContent>
     </Card>
   );
 };