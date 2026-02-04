import { ParsedResponse } from "./types";

/**
 * Debug info for parser diagnostics
 */
export interface ParserDebugInfo {
  htmlLength: number;
  markers: {
    hasQuestionId: boolean;
    hasQuestionIdVariants: string[];
    hasOptionIds: boolean;
    hasChosenOption: boolean;
    hasGivenAnswer: boolean;
    hasQuestionPalette: boolean;
  };
  scriptBlocks: {
    count: number;
    topLengths: number[];
    hasJsonLikeData: boolean;
  };
  cleanTextPreview: string;
  largestScriptPreview: string;
  strategyUsed: string;
  responseCount: number;
}

/**
 * Parse Digialm response sheet HTML using multiple strategies
 */
export function parseDigialmResponseSheet(html: string): ParsedResponse[] {
  console.log("Starting multi-strategy Digialm parser");
  
  // Strategy A: DOM-based parsing with flexible patterns
  let responses = parseWithDOMStrategy(html);
  if (responses.length > 0) {
    console.log(`Strategy A (DOM) succeeded: ${responses.length} responses`);
    return responses;
  }
  
  // Strategy B: Script/JSON extraction
  responses = parseWithScriptStrategy(html);
  if (responses.length > 0) {
    console.log(`Strategy B (Script/JSON) succeeded: ${responses.length} responses`);
    return responses;
  }
  
  // Strategy C: Pure text normalization with flexible patterns
  responses = parseWithTextStrategy(html);
  if (responses.length > 0) {
    console.log(`Strategy C (Text) succeeded: ${responses.length} responses`);
    return responses;
  }
  
  console.log("All parsing strategies failed");
  return [];
}

/**
 * Strategy A: DOM-based parsing with flexible question ID patterns
 */
function parseWithDOMStrategy(html: string): ParsedResponse[] {
  const responses: ParsedResponse[] = [];
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, "text/html");
  
  let currentSubject = "Mathematics";
  
  // Helper to detect subject from text
  const detectSubject = (text: string): string | null => {
    const lower = text.toLowerCase();
    if (lower.includes("math")) return "Mathematics";
    if (lower.includes("physics")) return "Physics";
    if (lower.includes("chemistry") || lower.includes("chem")) return "Chemistry";
    return null;
  };
  
  // Find all tables - Digialm often uses tables for question data
  const tables = doc.querySelectorAll("table");
  
  tables.forEach(table => {
    const rows = table.querySelectorAll("tr");
    let currentQuestionId = "";
    let optionIds: Record<number, string> = {};
    let chosenOption = "";
    let givenAnswer = "";
    let status = "";
    let questionType: "mcq_single" | "numerical" = "mcq_single";
    
    rows.forEach(row => {
      const text = row.textContent || "";
      
      // Check for section/subject headers
      const subj = detectSubject(text);
      if (subj && (text.toLowerCase().includes("section") || text.includes("Section"))) {
        currentSubject = subj;
      }
      
      // Look for question type indicators
      if (/Question\s*Type\s*[:\s]*(MCQ|SA|Numerical)/i.test(text)) {
        const match = text.match(/Question\s*Type\s*[:\s]*(MCQ|SA|Numerical)/i);
        if (match) {
          questionType = match[1].toLowerCase() === "mcq" ? "mcq_single" : "numerical";
        }
      }
      
      // Multiple patterns for Question ID
      const qIdPatterns = [
        /Question\s*ID\s*[:\s]*(\d{6,12})/i,
        /QuestionID\s*[:\s]*(\d{6,12})/i,
        /Q\.?\s*ID\s*[:\s]*(\d{6,12})/i,
        /Question\s*No\.?\s*[:\s]*(\d+)/i,
      ];
      
      for (const pattern of qIdPatterns) {
        const match = text.match(pattern);
        if (match) {
          // Save previous question if exists
          if (currentQuestionId) {
            const response = buildResponse(currentQuestionId, questionType, optionIds, chosenOption, givenAnswer, status);
            if (response) responses.push(response);
          }
          currentQuestionId = match[1];
          optionIds = {};
          chosenOption = "";
          givenAnswer = "";
          status = "";
          break;
        }
      }
      
      // Option ID patterns
      const optPatterns = [
        /Option\s*(\d)\s*ID\s*[:\s]*(\d+)/gi,
        /Option\s*([A-D])\s*ID\s*[:\s]*(\d+)/gi,
        /Opt(\d)\s*ID\s*[:\s]*(\d+)/gi,
      ];
      
      for (const pattern of optPatterns) {
        let match;
        while ((match = pattern.exec(text)) !== null) {
          let optNum = match[1];
          // Convert A-D to 1-4
          if (/[A-D]/i.test(optNum)) {
            optNum = String("ABCD".indexOf(optNum.toUpperCase()) + 1);
          }
          optionIds[parseInt(optNum, 10)] = match[2];
        }
      }
      
      // Status patterns
      if (/Status\s*[:\s]*(Answered|Not\s*Answered|Marked|Not\s*Visited)/i.test(text)) {
        const match = text.match(/Status\s*[:\s]*(Answered|Not\s*Answered|Marked|Not\s*Visited)/i);
        if (match) status = match[1];
      }
      
      // Chosen option patterns
      const chosenPatterns = [
        /Chosen\s*Option\s*[:\s]*(\d|--|-)/i,
        /Selected\s*Option\s*[:\s]*(\d|--|-)/i,
        /Candidate\s*Response\s*[:\s]*(\d|--|-)/i,
      ];
      
      for (const pattern of chosenPatterns) {
        const match = text.match(pattern);
        if (match) {
          chosenOption = match[1];
          break;
        }
      }
      
      // Given answer patterns (for numerical)
      const givenPatterns = [
        /Given\s*Answer\s*[:\s]*(-?\d+\.?\d*|--|-)/i,
        /Numeric\s*Answer\s*[:\s]*(-?\d+\.?\d*|--|-)/i,
        /SA\s*Answer\s*[:\s]*(-?\d+\.?\d*|--|-)/i,
      ];
      
      for (const pattern of givenPatterns) {
        const match = text.match(pattern);
        if (match) {
          givenAnswer = match[1];
          questionType = "numerical";
          break;
        }
      }
    });
    
    // Save last question from table
    if (currentQuestionId) {
      const response = buildResponse(currentQuestionId, questionType, optionIds, chosenOption, givenAnswer, status);
      if (response) responses.push(response);
    }
  });
  
  // Also try finding question containers by class patterns
  const questionContainers = doc.querySelectorAll(
    '[class*="question"], [class*="Question"], [class*="qstn"], [class*="item-lbl"], .rw, .questionRowTbl'
  );
  
  if (responses.length === 0 && questionContainers.length > 0) {
    let currentQuestionId = "";
    let optionIds: Record<number, string> = {};
    let chosenOption = "";
    let givenAnswer = "";
    let status = "";
    let questionType: "mcq_single" | "numerical" = "mcq_single";
    
    questionContainers.forEach(container => {
      const text = container.textContent || "";
      
      // Same extraction logic as above
      const qIdMatch = text.match(/(\d{9,12})/);
      if (qIdMatch && text.toLowerCase().includes("q.")) {
        if (currentQuestionId) {
          const response = buildResponse(currentQuestionId, questionType, optionIds, chosenOption, givenAnswer, status);
          if (response) responses.push(response);
        }
        currentQuestionId = qIdMatch[1];
        optionIds = {};
        chosenOption = "";
        givenAnswer = "";
      }
      
      // Extract option IDs from the container
      const optMatches = text.matchAll(/(\d{10})/g);
      let optIndex = 1;
      for (const match of optMatches) {
        if (match[1] !== currentQuestionId) {
          optionIds[optIndex++] = match[1];
          if (optIndex > 4) break;
        }
      }
      
      // Check for chosen option
      if (/Chosen\s*Option\s*[:\s]*(\d)/i.test(text)) {
        const match = text.match(/Chosen\s*Option\s*[:\s]*(\d)/i);
        if (match) chosenOption = match[1];
      }
      
      // Check for given answer
      if (/Given\s*Answer\s*[:\s]*(-?\d+\.?\d*)/i.test(text)) {
        const match = text.match(/Given\s*Answer\s*[:\s]*(-?\d+\.?\d*)/i);
        if (match) {
          givenAnswer = match[1];
          questionType = "numerical";
        }
      }
      
      // Check status
      if (/Answered/i.test(text) && !/Not\s*Answered/i.test(text)) {
        status = "Answered";
      }
    });
    
    if (currentQuestionId) {
      const response = buildResponse(currentQuestionId, questionType, optionIds, chosenOption, givenAnswer, status);
      if (response) responses.push(response);
    }
  }
  
  return responses;
}

/**
 * Strategy B: Extract data from script tags containing JSON
 */
function parseWithScriptStrategy(html: string): ParsedResponse[] {
  const responses: ParsedResponse[] = [];
  
  // Extract all script tag contents
  const scriptPattern = /<script[^>]*>([\s\S]*?)<\/script>/gi;
  const scripts: string[] = [];
  let match;
  
  while ((match = scriptPattern.exec(html)) !== null) {
    if (match[1].length > 100) {
      scripts.push(match[1]);
    }
  }
  
  // Sort by length (largest first - most likely to contain data)
  scripts.sort((a, b) => b.length - a.length);
  
  for (const script of scripts) {
    // Look for question data patterns in the script
    const questionPatterns = [
      /"questionId"\s*:\s*"?(\d+)"?/gi,
      /'questionId'\s*:\s*'?(\d+)'?/gi,
      /question_id\s*[=:]\s*['"]?(\d+)['"]?/gi,
      /QuestionID\s*[=:]\s*['"]?(\d+)['"]?/gi,
    ];
    
    const questionIds: string[] = [];
    for (const pattern of questionPatterns) {
      let qMatch;
      while ((qMatch = pattern.exec(script)) !== null) {
        if (!questionIds.includes(qMatch[1])) {
          questionIds.push(qMatch[1]);
        }
      }
    }
    
    if (questionIds.length > 0) {
      console.log(`Found ${questionIds.length} question IDs in script`);
      
      // Try to extract answer data for each question
      for (const qId of questionIds) {
        // Look for associated answer data
        const answerPatterns = [
          new RegExp(`"${qId}"[^}]*?"candidateAnswer"\\s*:\\s*"?([^",}]+)"?`, 'i'),
          new RegExp(`"${qId}"[^}]*?"selectedOption"\\s*:\\s*"?([^",}]+)"?`, 'i'),
          new RegExp(`"${qId}"[^}]*?"givenAnswer"\\s*:\\s*"?([^",}]+)"?`, 'i'),
        ];
        
        let found = false;
        for (const pattern of answerPatterns) {
          const ansMatch = script.match(pattern);
          if (ansMatch) {
            const answer = ansMatch[1].trim();
            if (answer && answer !== "--" && answer !== "-") {
              if (/^\d+$/.test(answer) && parseInt(answer) <= 4) {
                responses.push({
                  question_id: qId,
                  claimed_option_ids: [answer],
                  is_attempted: true,
                });
              } else if (/^-?\d+\.?\d*$/.test(answer)) {
                responses.push({
                  question_id: qId,
                  claimed_numeric_value: parseFloat(answer),
                  is_attempted: true,
                });
              }
              found = true;
              break;
            }
          }
        }
        
        if (!found) {
          responses.push({
            question_id: qId,
            is_attempted: false,
          });
        }
      }
    }
    
    // Try to parse as JSON array
    try {
      // Look for array patterns
      const arrayMatch = script.match(/\[[\s\S]*\{[\s\S]*questionId[\s\S]*\}[\s\S]*\]/i);
      if (arrayMatch) {
        // Normalize to valid JSON
        let jsonStr = arrayMatch[0]
          .replace(/'/g, '"')
          .replace(/(\w+):/g, '"$1":')
          .replace(/,\s*}/g, '}')
          .replace(/,\s*\]/g, ']');
        
        const data = JSON.parse(jsonStr);
        if (Array.isArray(data)) {
          for (const item of data) {
            const qId = item.questionId || item.QuestionID || item.question_id;
            const answer = item.candidateAnswer || item.selectedOption || item.givenAnswer || item.answer;
            
            if (qId) {
              if (answer && answer !== "--") {
                if (typeof answer === "number" || /^-?\d+\.?\d*$/.test(answer)) {
                  responses.push({
                    question_id: String(qId),
                    claimed_numeric_value: parseFloat(answer),
                    is_attempted: true,
                  });
                } else {
                  responses.push({
                    question_id: String(qId),
                    claimed_option_ids: [String(answer)],
                    is_attempted: true,
                  });
                }
              } else {
                responses.push({
                  question_id: String(qId),
                  is_attempted: false,
                });
              }
            }
          }
        }
      }
    } catch {
      // JSON parsing failed, continue
    }
  }
  
  return responses;
}

/**
 * Strategy C: Pure text normalization with flexible patterns
 */
function parseWithTextStrategy(html: string): ParsedResponse[] {
  const responses: ParsedResponse[] = [];
  
  // Convert HTML to text while preserving structure
  let text = html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(div|p|tr|td|th|table|span|li)>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#\d+;/g, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/\n+/g, "\n")
    .trim();
  
  const lines = text.split("\n").map(l => l.trim()).filter(Boolean);
  
  let currentQuestionId = "";
  let optionIds: Record<number, string> = {};
  let chosenOption = "";
  let givenAnswer = "";
  let status = "";
  let questionType: "mcq_single" | "numerical" = "mcq_single";
  let currentSubject = "Mathematics";
  
  const saveCurrentQuestion = () => {
    if (currentQuestionId) {
      const response = buildResponse(currentQuestionId, questionType, optionIds, chosenOption, givenAnswer, status);
      if (response) responses.push(response);
    }
    optionIds = {};
    chosenOption = "";
    givenAnswer = "";
    status = "";
  };
  
  for (const line of lines) {
    // Subject detection
    if (/section\s*:?\s*(math|physics|chem)/i.test(line)) {
      const lower = line.toLowerCase();
      if (lower.includes("math")) currentSubject = "Mathematics";
      else if (lower.includes("physics")) currentSubject = "Physics";
      else if (lower.includes("chem")) currentSubject = "Chemistry";
    }
    
    // Question type
    if (/Question\s*Type\s*[:\s]*(MCQ|SA|Numerical)/i.test(line)) {
      const match = line.match(/Question\s*Type\s*[:\s]*(MCQ|SA|Numerical)/i);
      if (match) {
        questionType = match[1].toLowerCase() === "mcq" ? "mcq_single" : "numerical";
      }
    }
    
    // Flexible Question ID patterns
    const qIdPatterns = [
      /Question\s*ID\s*[:\s]*(\d{6,12})/i,
      /QuestionID\s*[:\s]*(\d{6,12})/i,
      /Q\.?\s*ID\s*[:\s]*(\d{6,12})/i,
      /^Q\.?\s*(\d+)\s/i,
      /Question\s*No\.?\s*[:\s]*(\d+)/i,
    ];
    
    for (const pattern of qIdPatterns) {
      const match = line.match(pattern);
      if (match) {
        saveCurrentQuestion();
        currentQuestionId = match[1];
        break;
      }
    }
    
    // Option IDs
    const optMatch = line.match(/Option\s*(\d)\s*ID\s*[:\s]*(\d+)/i);
    if (optMatch) {
      optionIds[parseInt(optMatch[1], 10)] = optMatch[2];
    }
    
    // Status
    if (/Status\s*[:\s]*(Answered|Not\s*Answered|Marked)/i.test(line)) {
      const match = line.match(/Status\s*[:\s]*(Answered|Not\s*Answered|Marked)/i);
      if (match) status = match[1];
    }
    
    // Chosen option
    const chosenPatterns = [
      /Chosen\s*Option\s*[:\s]*(\d|--|-)/i,
      /Selected\s*Option\s*[:\s]*(\d|--|-)/i,
      /Candidate\s*Response\s*[:\s]*(\d|--|-)/i,
    ];
    for (const pattern of chosenPatterns) {
      const match = line.match(pattern);
      if (match) {
        chosenOption = match[1];
        break;
      }
    }
    
    // Given answer
    const givenPatterns = [
      /Given\s*Answer\s*[:\s]*(-?\d+\.?\d*|--|-)/i,
      /Numeric\s*Answer\s*[:\s]*(-?\d+\.?\d*|--|-)/i,
    ];
    for (const pattern of givenPatterns) {
      const match = line.match(pattern);
      if (match) {
        givenAnswer = match[1];
        questionType = "numerical";
        break;
      }
    }
  }
  
  // Save last question
  saveCurrentQuestion();
  
  return responses;
}

/**
 * Build a ParsedResponse from extracted data
 */
function buildResponse(
  questionId: string,
  questionType: "mcq_single" | "numerical",
  optionIds: Record<number, string>,
  chosenOption: string,
  givenAnswer: string,
  status: string
): ParsedResponse | null {
  if (!questionId) return null;
  
  const isAnswered = status.toLowerCase().includes("answered") && 
                     !status.toLowerCase().includes("not answered");
  
  if (questionType === "numerical") {
    if (givenAnswer && givenAnswer !== "--" && givenAnswer !== "-") {
      const numValue = parseFloat(givenAnswer);
      if (!isNaN(numValue)) {
        return {
          question_id: questionId,
          claimed_numeric_value: numValue,
          is_attempted: true,
        };
      }
    }
    return { question_id: questionId, is_attempted: false };
  }
  
  // MCQ
  if (chosenOption && chosenOption !== "--" && chosenOption !== "-") {
    const optNum = parseInt(chosenOption, 10);
    if (optNum >= 1 && optNum <= 4) {
      const optionId = optionIds[optNum];
      if (optionId) {
        return {
          question_id: questionId,
          claimed_option_ids: [optionId],
          is_attempted: true,
        };
      }
      // Fallback to using option number directly
      return {
        question_id: questionId,
        claimed_option_ids: [String(optNum)],
        is_attempted: true,
      };
    }
  }
  
  return { question_id: questionId, is_attempted: false };
}

/**
 * Validate if the HTML looks like a Digialm response sheet
 */
export function isDigialmFormat(html: string): boolean {
  const markers = [
    /digialm/i,
    /Question\s*ID/i,
    /QuestionID/i,
    /Chosen\s*Option/i,
    /Option\s*\d\s*ID/i,
    /AssessmentQP/i,
    /NTA\s*JEE/i,
  ];

  const matchCount = markers.filter(pattern => pattern.test(html)).length;
  return matchCount >= 2;
}

/**
 * Get comprehensive debug info from HTML
 */
export function getDigialmDebugInfo(html: string): ParserDebugInfo {
  // Check for question ID variants
  const qIdVariants: string[] = [];
  if (/Question\s*ID/i.test(html)) qIdVariants.push("Question ID");
  if (/QuestionID/i.test(html)) qIdVariants.push("QuestionID");
  if (/QUESTION\s*ID/i.test(html)) qIdVariants.push("QUESTION ID");
  if (/Q\.?\s*ID/i.test(html)) qIdVariants.push("Q.ID");
  if (/Question\s*No/i.test(html)) qIdVariants.push("Question No");
  
  // Extract script blocks
  const scriptPattern = /<script[^>]*>([\s\S]*?)<\/script>/gi;
  const scripts: string[] = [];
  let match;
  while ((match = scriptPattern.exec(html)) !== null) {
    scripts.push(match[1]);
  }
  
  const topScriptLengths = scripts
    .map(s => s.length)
    .sort((a, b) => b - a)
    .slice(0, 3);
  
  // Check for JSON-like data in scripts
  const hasJsonLikeData = scripts.some(s => 
    /questionId|question_id|QuestionID/i.test(s) && s.length > 5000
  );
  
  // Convert to clean text
  const cleanText = html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
  
  // Get largest script content
  const largestScript = scripts.sort((a, b) => b.length - a.length)[0] || "";
  
  return {
    htmlLength: html.length,
    markers: {
      hasQuestionId: qIdVariants.length > 0,
      hasQuestionIdVariants: qIdVariants,
      hasOptionIds: /Option\s*\d\s*ID/i.test(html),
      hasChosenOption: /Chosen\s*Option|Selected\s*Option|Candidate\s*Response/i.test(html),
      hasGivenAnswer: /Given\s*Answer|Numeric\s*Answer/i.test(html),
      hasQuestionPalette: /question.*palette|q\d{1,2}|item-\d+/i.test(html),
    },
    scriptBlocks: {
      count: scripts.length,
      topLengths: topScriptLengths,
      hasJsonLikeData,
    },
    cleanTextPreview: cleanText.substring(0, 3000),
    largestScriptPreview: largestScript.substring(0, 2000),
    strategyUsed: "",
    responseCount: 0,
  };
}

/**
 * Get diagnostic message for parsing failures
 */
export function getDigialmDiagnostic(html: string): {
  hasQuestionIds: boolean;
  hasOptionIds: boolean;
  hasChosenOptions: boolean;
  questionCount: number;
} {
  const questionMatches = html.match(/Question\s*ID\s*[:\s]*\d+/gi) || [];
  const optionMatches = html.match(/Option\s*\d\s*ID\s*[:\s]*\d+/gi) || [];
  const chosenMatches = html.match(/Chosen\s*Option\s*:/gi) || [];

  return {
    hasQuestionIds: questionMatches.length > 0,
    hasOptionIds: optionMatches.length > 0,
    hasChosenOptions: chosenMatches.length > 0,
    questionCount: questionMatches.length,
  };
}
