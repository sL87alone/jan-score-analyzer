import { ParsedResponse } from "./types";

/**
 * Parse JEE Main Response Sheet HTML to extract student responses
 * This handles the typical NTA response sheet format
 */
export function parseResponseSheetHTML(html: string): ParsedResponse[] {
  const responses: ParsedResponse[] = [];
  
  // Create a DOM parser
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, "text/html");
  
  // Look for question tables - NTA typically uses tables with specific patterns
  const tables = doc.querySelectorAll("table");
  
  tables.forEach((table) => {
    const rows = table.querySelectorAll("tr");
    
    rows.forEach((row) => {
      const cells = row.querySelectorAll("td");
      
      // Look for patterns like "Question ID", "Chosen Option", etc.
      cells.forEach((cell, index) => {
        const text = cell.textContent?.trim() || "";
        
        // Pattern 1: Question ID followed by response
        if (text.match(/^\d{10,}$/) || text.match(/^Q\d+$/i)) {
          const questionId = text;
          const nextCell = cells[index + 1];
          
          if (nextCell) {
            const responseText = nextCell.textContent?.trim() || "";
            
            // Check if it's a chosen option (A, B, C, D format or numeric)
            if (responseText.match(/^[A-D]$/i)) {
              responses.push({
                question_id: questionId,
                claimed_option_ids: [responseText.toUpperCase()],
                is_attempted: true,
              });
            } else if (responseText.match(/^[A-D,\s]+$/i)) {
              // Multiple options (MSQ)
              const options = responseText.split(/[,\s]+/).filter(Boolean);
              responses.push({
                question_id: questionId,
                claimed_option_ids: options.map((o) => o.toUpperCase()),
                is_attempted: true,
              });
            } else if (responseText.match(/^-?\d+\.?\d*$/)) {
              // Numerical answer
              responses.push({
                question_id: questionId,
                claimed_numeric_value: parseFloat(responseText),
                is_attempted: true,
              });
            } else if (responseText === "--" || responseText === "" || responseText.toLowerCase() === "not answered") {
              responses.push({
                question_id: questionId,
                is_attempted: false,
              });
            }
          }
        }
      });
    });
  });

  // Alternative parsing: Look for specific patterns in the HTML
  // NTA format often has "Question ID : XXXXXXXXXX" and "Chosen Option : X"
  const htmlText = html;
  
  // Pattern matching for common NTA format
  const questionPattern = /Question\s*(?:ID|No\.?)?\s*[:\s]*(\d{10,}|\d+)/gi;
  const chosenPattern = /(?:Chosen|Selected)\s*(?:Option|Answer)\s*[:\s]*([A-D,\s]+|--|-?\d+\.?\d*)/gi;
  
  let questionMatches = [...htmlText.matchAll(questionPattern)];
  let chosenMatches = [...htmlText.matchAll(chosenPattern)];
  
  if (questionMatches.length > 0 && questionMatches.length === chosenMatches.length) {
    questionMatches.forEach((qMatch, idx) => {
      const questionId = qMatch[1];
      const chosen = chosenMatches[idx]?.[1]?.trim() || "";
      
      // Avoid duplicates
      if (responses.find((r) => r.question_id === questionId)) return;
      
      if (chosen.match(/^[A-D]$/i)) {
        responses.push({
          question_id: questionId,
          claimed_option_ids: [chosen.toUpperCase()],
          is_attempted: true,
        });
      } else if (chosen.match(/^[A-D,\s]+$/i)) {
        const options = chosen.split(/[,\s]+/).filter(Boolean);
        responses.push({
          question_id: questionId,
          claimed_option_ids: options.map((o) => o.toUpperCase()),
          is_attempted: true,
        });
      } else if (chosen.match(/^-?\d+\.?\d*$/)) {
        responses.push({
          question_id: questionId,
          claimed_numeric_value: parseFloat(chosen),
          is_attempted: true,
        });
      } else {
        responses.push({
          question_id: questionId,
          is_attempted: false,
        });
      }
    });
  }

  return responses;
}

/**
 * Validate if the HTML content is a valid JEE response sheet
 */
export function validateResponseSheet(html: string): { valid: boolean; message: string } {
  if (!html || html.length < 100) {
    return { valid: false, message: "File appears to be empty or too small" };
  }

  // Check for common indicators of JEE response sheet
  const indicators = [
    /question/i,
    /response/i,
    /option/i,
    /answer/i,
    /jee/i,
    /nta/i,
  ];

  const matchCount = indicators.filter((pattern) => pattern.test(html)).length;

  if (matchCount < 2) {
    return { 
      valid: false, 
      message: "This doesn't appear to be a valid JEE response sheet. Please upload the correct HTML file." 
    };
  }

  return { valid: true, message: "Valid response sheet" };
}
