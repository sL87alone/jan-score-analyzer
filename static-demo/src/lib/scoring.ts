 import { ParsedResponse } from "./parser";
 
 export interface ScoreResult {
   totalMarks: number;
   totalCorrect: number;
   totalWrong: number;
   totalUnattempted: number;
   accuracy: number;
   negativeMarks: number;
   mathMarks: number;
   physicsMarks: number;
   chemistryMarks: number;
 }
 
 // JEE Main marking scheme
 const MARKS = {
   MCQ_CORRECT: 4,
   MCQ_WRONG: -1,
   NAT_CORRECT: 4,
   NAT_WRONG: 0, // No negative for numerical
 };
 
 export function calculateScore(responses: ParsedResponse[]): ScoreResult {
   let totalMarks = 0;
   let totalCorrect = 0;
   let totalWrong = 0;
   let totalUnattempted = 0;
   let negativeMarks = 0;
 
   let mathMarks = 0;
   let physicsMarks = 0;
   let chemistryMarks = 0;
 
   responses.forEach((response) => {
     let marks = 0;
 
     if (response.status === "correct") {
       marks = response.questionType === "MCQ" ? MARKS.MCQ_CORRECT : MARKS.NAT_CORRECT;
       totalCorrect++;
     } else if (response.status === "wrong") {
       marks = response.questionType === "MCQ" ? MARKS.MCQ_WRONG : MARKS.NAT_WRONG;
       totalWrong++;
       if (marks < 0) {
         negativeMarks += Math.abs(marks);
       }
     } else {
       totalUnattempted++;
     }
 
     totalMarks += marks;
 
     // Subject-wise marks
     switch (response.subject) {
       case "math":
         mathMarks += marks;
         break;
       case "physics":
         physicsMarks += marks;
         break;
       case "chemistry":
         chemistryMarks += marks;
         break;
     }
   });
 
   const attempted = totalCorrect + totalWrong;
   const accuracy = attempted > 0 ? Math.round((totalCorrect / attempted) * 100) : 0;
 
   return {
     totalMarks,
     totalCorrect,
     totalWrong,
     totalUnattempted,
     accuracy,
     negativeMarks,
     mathMarks,
     physicsMarks,
     chemistryMarks,
   };
 }