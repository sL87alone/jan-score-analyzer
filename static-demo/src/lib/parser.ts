 // Client-side JEE Main response sheet parser
 
 export interface ParsedResponse {
   questionId: string;
   subject: "math" | "physics" | "chemistry";
   questionType: "MCQ" | "NAT"; // MCQ or Numerical Answer Type
   section: "A" | "B";
   chosenOption: string | null;
   chosenValue: number | null;
   correctOption: string | null;
   correctValue: number | null;
   status: "correct" | "wrong" | "unattempted";
 }
 
 export function parseResponseSheet(html: string): ParsedResponse[] {
   const responses: ParsedResponse[] = [];
 
   try {
     const parser = new DOMParser();
     const doc = parser.parseFromString(html, "text/html");
 
     // Find all question tables
     const tables = doc.querySelectorAll("table.menu-tbl");
 
     let currentSubject: "math" | "physics" | "chemistry" = "physics";
     let questionIndex = 0;
 
     tables.forEach((table) => {
       const rows = table.querySelectorAll("tr");
 
       rows.forEach((row) => {
         const cells = row.querySelectorAll("td");
         if (cells.length < 2) return;
 
         // Check for subject header
         const headerText = cells[0]?.textContent?.toLowerCase() || "";
         if (headerText.includes("mathematics")) {
           currentSubject = "math";
           questionIndex = 0;
           return;
         } else if (headerText.includes("physics")) {
           currentSubject = "physics";
           questionIndex = 0;
           return;
         } else if (headerText.includes("chemistry")) {
           currentSubject = "chemistry";
           questionIndex = 0;
           return;
         }
 
         // Parse question row
         const qIdCell = cells[0]?.textContent?.trim();
         if (!qIdCell || !qIdCell.match(/^\d+$/)) return;
 
         questionIndex++;
 
         // Determine section (first 20 are Section A MCQ, last 5 are Section B Numerical)
         const section = questionIndex <= 20 ? "A" : "B";
         const questionType = section === "A" ? "MCQ" : "NAT";
 
         // Extract chosen and correct answers
         let chosenOption: string | null = null;
         let chosenValue: number | null = null;
         let correctOption: string | null = null;
         let correctValue: number | null = null;
         let status: "correct" | "wrong" | "unattempted" = "unattempted";
 
         // Look for answer cells
         for (let i = 1; i < cells.length; i++) {
           const cellText = cells[i]?.textContent?.trim() || "";
 
           // Chosen answer
           if (cellText.startsWith("Chosen Option")) {
             const match = cellText.match(/Chosen Option\s*:\s*(\d+|[A-D]|--)/i);
             if (match && match[1] !== "--") {
               chosenOption = match[1];
             }
           }
 
           // Correct answer
           if (cellText.includes("Correct Answer")) {
             const match = cellText.match(/Correct Answer\s*:\s*(\d+|[A-D])/i);
             if (match) {
               correctOption = match[1];
             }
           }
 
           // Status
           if (cellText.includes("Correct")) {
             status = "correct";
           } else if (cellText.includes("Wrong") || cellText.includes("Incorrect")) {
             status = "wrong";
           }
         }
 
         // Numerical type parsing
         if (questionType === "NAT") {
           // Try to parse as number
           if (chosenOption && !isNaN(parseFloat(chosenOption))) {
             chosenValue = parseFloat(chosenOption);
             chosenOption = null;
           }
           if (correctOption && !isNaN(parseFloat(correctOption))) {
             correctValue = parseFloat(correctOption);
             correctOption = null;
           }
         }
 
         responses.push({
           questionId: `${currentSubject.toUpperCase()}-${qIdCell}`,
           subject: currentSubject,
           questionType,
           section,
           chosenOption,
           chosenValue,
           correctOption,
           correctValue,
           status,
         });
       });
     });
 
     // If no tables found, try alternative parsing
     if (responses.length === 0) {
       // Look for span elements with question data
       const questionSpans = doc.querySelectorAll("span.bold");
       // Alternative parsing logic can be added here
     }
 
   } catch (error) {
     console.error("Parser error:", error);
   }
 
   return responses;
 }