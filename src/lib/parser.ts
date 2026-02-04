import { ParsedResponse } from "./types";
import { parseDigialmResponseSheet, isDigialmFormat, getDigialmDiagnostic, getDigialmDebugInfo, ParserDebugInfo } from "./digialmParser";

export type { ParserDebugInfo } from "./digialmParser";
export { getDigialmDebugInfo } from "./digialmParser";

/**
 * Deduplicate responses by question_id, keeping the last occurrence
 * Also ensures question_id is always a string
 */
function deduplicateResponses(responses: ParsedResponse[]): ParsedResponse[] {
  const map = new Map<string, ParsedResponse>();
  for (const r of responses) {
    // Ensure question_id is always a string
    const qid = String(r.question_id);
    map.set(qid, {
      ...r,
      question_id: qid,
      // Ensure option IDs are strings too
      claimed_option_ids: r.claimed_option_ids?.map(id => String(id)),
    });
  }
  return Array.from(map.values());
}

/**
 * Parse JEE Main Response Sheet HTML to extract student responses
 * Supports multiple formats: Digialm (cdn3.digialm.com) and traditional table format
 * Returns deduplicated responses by question_id
 */
export function parseResponseSheetHTML(html: string): { responses: ParsedResponse[]; rawCount: number } {
  let rawResponses: ParsedResponse[] = [];
  
  // First, try the Digialm parser if the format matches
  if (isDigialmFormat(html)) {
    console.log("Detected Digialm format, using specialized parser");
    const diagnostic = getDigialmDiagnostic(html);
    console.log("Digialm diagnostic:", diagnostic);
    
    rawResponses = parseDigialmResponseSheet(html);
    if (rawResponses.length > 0) {
      console.log(`Digialm parser found ${rawResponses.length} raw responses`);
      const deduplicated = deduplicateResponses(rawResponses);
      console.log(`After deduplication: ${deduplicated.length} unique responses`);
      return { responses: deduplicated, rawCount: rawResponses.length };
    }
    console.log("Digialm parser returned 0 responses, falling back to generic parser");
  }

  // Fall back to generic table-based parser
  rawResponses = parseGenericTableFormat(html);
  
  // Deduplicate before returning
  const deduplicated = deduplicateResponses(rawResponses);
  console.log(`Generic parser: ${rawResponses.length} raw -> ${deduplicated.length} unique`);
  return { responses: deduplicated, rawCount: rawResponses.length };
}

/**
 * Generic table-based parser for fallback
 */
function parseGenericTableFormat(html: string): ParsedResponse[] {
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
  
  if (responses.length === 0 && questionMatches.length > 0 && questionMatches.length === chosenMatches.length) {
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

  // Check for Digialm format first
  if (isDigialmFormat(html)) {
    return { valid: true, message: "Valid Digialm response sheet" };
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

/**
 * Get parsing diagnostic info for error messages
 */
export function getParsingDiagnostic(html: string): string {
  const diagnostic = getDigialmDiagnostic(html);
  const debugInfo = getDigialmDebugInfo(html);
  
  let message = "";
  
  if (diagnostic.questionCount === 0) {
    message = `We fetched the page (${html.length} bytes) but couldn't detect Question ID blocks.`;
    
    if (debugInfo.markers.hasQuestionIdVariants.length > 0) {
      message += ` Found markers: ${debugInfo.markers.hasQuestionIdVariants.join(", ")}.`;
    }
    
    if (debugInfo.scriptBlocks.hasJsonLikeData) {
      message += ` Found ${debugInfo.scriptBlocks.count} script blocks with potential JSON data.`;
    }
    
    message += ` The Digialm format may have changed. Try uploading the response HTML file instead.`;
  } else {
    message = `Found ${diagnostic.questionCount} questions but could not parse responses. `;
    message += `Has Option IDs: ${diagnostic.hasOptionIds}, Has Chosen Options: ${diagnostic.hasChosenOptions}.`;
  }
  
  return message;
}

export interface MatchingStats {
  rawParsedCount: number;
  uniqueQuestionCount: number;
  matchedWithKeyCount: number;
  mismatchedIds: string[];
  subjectBreakdown: {
    subject: string;
    matched: number;
    total: number;
  }[];
}

/**
 * Match parsed responses against answer keys and return detailed stats
 */
export function matchResponsesWithKeys(
  parsedResponses: ParsedResponse[],
  answerKeys: { question_id: string; subject: string; question_type: string }[]
): MatchingStats {
  const keyMap = new Map<string, { subject: string; question_type: string }>();
  answerKeys.forEach(k => keyMap.set(String(k.question_id), { subject: k.subject, question_type: k.question_type }));
  
  const parsedIds = new Set(parsedResponses.map(r => String(r.question_id)));
  const keyIds = new Set(answerKeys.map(k => String(k.question_id)));
  
  // Find matched and mismatched
  const matched: string[] = [];
  const mismatched: string[] = [];
  
  parsedIds.forEach(id => {
    if (keyIds.has(id)) {
      matched.push(id);
    } else {
      mismatched.push(id);
    }
  });
  
  // Subject breakdown from matched responses
  const subjectCounts: Record<string, { matched: number; total: number }> = {
    Mathematics: { matched: 0, total: 0 },
    Physics: { matched: 0, total: 0 },
    Chemistry: { matched: 0, total: 0 },
  };
  
  // Count total per subject from answer keys
  answerKeys.forEach(k => {
    if (subjectCounts[k.subject]) {
      subjectCounts[k.subject].total++;
    }
  });
  
  // Count matched per subject
  matched.forEach(id => {
    const key = keyMap.get(id);
    if (key && subjectCounts[key.subject]) {
      subjectCounts[key.subject].matched++;
    }
  });
  
  return {
    rawParsedCount: 0, // Will be set by caller
    uniqueQuestionCount: parsedResponses.length,
    matchedWithKeyCount: matched.length,
    mismatchedIds: mismatched.slice(0, 10), // First 10 mismatched
    subjectBreakdown: Object.entries(subjectCounts).map(([subject, counts]) => ({
      subject,
      matched: counts.matched,
      total: counts.total,
    })),
  };
}
