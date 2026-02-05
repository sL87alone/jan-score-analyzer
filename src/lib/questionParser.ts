 import { ParsedResponse } from "./types";
 
 /**
  * Detailed question data extracted from response sheets
  */
 export interface ExtractedQuestion {
   question_id: string;
   qno: number;
   subject: string;
   section: "A" | "B";
   question_text: string;
   options: { id: string; label: string; text: string }[];
   user_answer: string | number | null;
   is_attempted: boolean;
   is_numerical: boolean;
 }
 
 /**
  * Question result after scoring (stored in DB)
  */
 export interface QuestionResult {
   question_id: string;
   qno: number;
   subject: string;
   section: "A" | "B";
   attempted: boolean;
   is_correct: boolean;
   marks_awarded: number;
   negative: number;
   user_answer: string | number | null;
   correct_answer: string | number | null;
   question_text: string;
   options: { id: string; label: string; text: string }[];
 }
 
 /**
  * Extract detailed question data from response sheet HTML
  * Parses question text, options, and user answers for display in analysis
  */
 export function extractQuestionsFromHTML(html: string): ExtractedQuestion[] {
   const questions: ExtractedQuestion[] = [];
   const parser = new DOMParser();
   const doc = parser.parseFromString(html, "text/html");
   
   // Strategy 1: Look for question containers in tables (Digialm format)
   const tables = doc.querySelectorAll("table");
   let questionNumber = 0;
   let currentSubject = "Mathematics";
   let currentSection: "A" | "B" = "A";
   
   // Track question blocks - look for patterns with Question ID
   const questionBlocks: Array<{
     id: string;
     qno: number;
     subject: string;
     section: "A" | "B";
     text: string;
     options: { id: string; label: string; text: string }[];
     userAnswer: string | number | null;
     isAttempted: boolean;
     isNumerical: boolean;
   }> = [];
   
   // First pass: detect subjects and sections from text
   const fullText = doc.body?.textContent || "";
   const detectSubjectSection = (text: string, qNum: number): { subject: string; section: "A" | "B" } => {
     // JEE Main pattern: Q1-20 per subject, Q1-15 Section A (MCQ), Q16-20 Section B (Numerical)
     // But question IDs are unique across paper, so use position-based heuristics
     const subjectFromQNum = Math.floor((qNum - 1) / 25); // 0=Math, 1=Physics, 2=Chem (roughly)
     const subjects = ["Mathematics", "Physics", "Chemistry"];
     const subject = subjects[subjectFromQNum] || currentSubject;
     
     // Within each subject, Q16-20 (or position 16-20 within 25) are typically numerical
     const posInSubject = ((qNum - 1) % 25) + 1;
     const section = posInSubject > 20 ? "B" : "A";
     
     return { subject, section };
   };
   
   // Parse each table for question data
   tables.forEach(table => {
     const rows = table.querySelectorAll("tr");
     let currentQuestionId = "";
     let currentText = "";
     let currentOptions: { id: string; label: string; text: string }[] = [];
     let chosenOption = "";
     let givenAnswer = "";
     let questionType: "mcq_single" | "numerical" = "mcq_single";
     let optionIds: Record<number, string> = {};
     let optionTexts: Record<number, string> = {};
     
     const saveQuestion = () => {
       if (!currentQuestionId) return;
       
       questionNumber++;
       const { subject, section } = detectSubjectSection(currentText, questionNumber);
       
       // Build options array
       const options: { id: string; label: string; text: string }[] = [];
       for (let i = 1; i <= 4; i++) {
         if (optionIds[i] || optionTexts[i]) {
           options.push({
             id: optionIds[i] || String(i),
             label: String.fromCharCode(64 + i), // A, B, C, D
             text: optionTexts[i] || `Option ${i}`,
           });
         }
       }
       
       // Determine user answer
       let userAnswer: string | number | null = null;
       let isAttempted = false;
       const isNumerical = questionType === "numerical" || 
         (givenAnswer !== "" && givenAnswer !== "--" && givenAnswer !== "-");
       
       if (isNumerical && givenAnswer && givenAnswer !== "--" && givenAnswer !== "-") {
         const numVal = parseFloat(givenAnswer);
         if (!isNaN(numVal)) {
           userAnswer = numVal;
           isAttempted = true;
         }
       } else if (chosenOption && chosenOption !== "--" && chosenOption !== "-") {
         const optNum = parseInt(chosenOption, 10);
         if (optNum >= 1 && optNum <= 4) {
           userAnswer = optionIds[optNum] || String(optNum);
           isAttempted = true;
         }
       }
       
       questionBlocks.push({
         id: currentQuestionId,
         qno: questionNumber,
         subject,
         section: isNumerical ? "B" : section,
         text: currentText.trim() || `Question ${questionNumber}`,
         options,
         userAnswer,
         isAttempted,
         isNumerical,
       });
       
       // Reset for next question
       currentQuestionId = "";
       currentText = "";
       currentOptions = [];
       chosenOption = "";
       givenAnswer = "";
       questionType = "mcq_single";
       optionIds = {};
       optionTexts = {};
     };
     
     rows.forEach(row => {
       const text = row.textContent || "";
       
       // Subject detection
       if (/math/i.test(text) && /section/i.test(text)) currentSubject = "Mathematics";
       else if (/physics/i.test(text) && /section/i.test(text)) currentSubject = "Physics";
       else if (/chem/i.test(text) && /section/i.test(text)) currentSubject = "Chemistry";
       
       // Question type
       if (/Question\s*Type\s*[:\s]*(MCQ|SA|Numerical)/i.test(text)) {
         const match = text.match(/Question\s*Type\s*[:\s]*(MCQ|SA|Numerical)/i);
         if (match) {
           questionType = match[1].toLowerCase() === "mcq" ? "mcq_single" : "numerical";
         }
       }
       
       // Question ID patterns
       const qIdMatch = text.match(/Question\s*ID\s*[:\s]*(\d{6,12})/i);
       if (qIdMatch) {
         saveQuestion();
         currentQuestionId = qIdMatch[1];
       }
       
       // Option IDs
       const optIdMatches = [...text.matchAll(/Option\s*(\d)\s*ID\s*[:\s]*(\d+)/gi)];
       optIdMatches.forEach(match => {
         optionIds[parseInt(match[1], 10)] = match[2];
       });
       
       // Chosen option
       const chosenMatch = text.match(/Chosen\s*Option\s*[:\s]*(\d|--|-)/i);
       if (chosenMatch) chosenOption = chosenMatch[1];
       
       // Given answer (numerical)
       const givenMatch = text.match(/Given\s*Answer\s*[:\s]*(-?\d+\.?\d*|--|-)/i);
       if (givenMatch) {
         givenAnswer = givenMatch[1];
         questionType = "numerical";
       }
       
       // Try to extract question text from row content
       // Look for long text that might be the question
       if (text.length > 50 && !text.match(/Question\s*ID|Option\s*\d|Status|Chosen|Given/i)) {
         currentText = text.substring(0, 500);
       }
     });
     
     // Save last question in table
     saveQuestion();
   });
   
   // Convert to ExtractedQuestion format
   questionBlocks.forEach(q => {
     questions.push({
       question_id: q.id,
       qno: q.qno,
       subject: q.subject,
       section: q.section,
       question_text: q.text,
       options: q.options,
       user_answer: q.userAnswer,
       is_attempted: q.isAttempted,
       is_numerical: q.isNumerical,
     });
   });
   
   return questions;
 }
 
 /**
  * Merge extracted questions with parsed responses
  * Use when question extraction partially fails
  */
 export function mergeWithParsedResponses(
   extracted: ExtractedQuestion[],
   parsed: ParsedResponse[]
 ): ExtractedQuestion[] {
   const extractedMap = new Map<string, ExtractedQuestion>();
   extracted.forEach(q => extractedMap.set(q.question_id, q));
   
   // Add any parsed responses not in extracted
   let qno = extracted.length;
   parsed.forEach(p => {
     const id = String(p.question_id);
     if (!extractedMap.has(id)) {
       qno++;
       const isNumerical = p.claimed_numeric_value !== undefined;
       extractedMap.set(id, {
         question_id: id,
         qno,
         subject: "Unknown",
         section: isNumerical ? "B" : "A",
         question_text: `Question ${qno}`,
         options: [],
         user_answer: isNumerical ? p.claimed_numeric_value! : (p.claimed_option_ids?.[0] || null),
         is_attempted: p.is_attempted,
         is_numerical: isNumerical,
       });
     }
   });
   
   return Array.from(extractedMap.values());
 }