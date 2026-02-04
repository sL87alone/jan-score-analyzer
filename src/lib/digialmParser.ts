import { ParsedResponse } from "./types";

/**
 * Parse Digialm response sheet HTML (cdn3.digialm.com format)
 * This handles the NTA JEE Main response sheet format with line-by-line question data
 */
export function parseDigialmResponseSheet(html: string): ParsedResponse[] {
  const responses: ParsedResponse[] = [];

  // Convert HTML to text while preserving line breaks
  let text = html
    // Replace <br> tags with newlines
    .replace(/<br\s*\/?>/gi, "\n")
    // Replace closing block tags with newlines
    .replace(/<\/(div|p|tr|td|th|table|span)>/gi, "\n")
    // Strip remaining HTML tags
    .replace(/<[^>]+>/g, " ")
    // Decode HTML entities
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    // Normalize multiple spaces
    .replace(/[ \t]+/g, " ")
    // Normalize multiple newlines
    .replace(/\n+/g, "\n")
    .trim();

  const lines = text.split("\n").map(line => line.trim()).filter(Boolean);

  let currentSubject = "Mathematics";
  let currentQuestionId = "";
  let currentQuestionType: "mcq_single" | "numerical" = "mcq_single";
  let optionIds: Record<number, string> = {};
  let status = "";
  let chosenOption = "";
  let givenAnswer = "";

  // Helper to detect subject from section name
  const detectSubject = (sectionText: string): string => {
    const lower = sectionText.toLowerCase();
    if (lower.includes("math")) return "Mathematics";
    if (lower.includes("physics")) return "Physics";
    if (lower.includes("chemistry") || lower.includes("chem")) return "Chemistry";
    return currentSubject;
  };

  // Helper to finalize current question
  const finalizeQuestion = () => {
    if (!currentQuestionId) return;

    const isAnswered = status.toLowerCase().includes("answered") && 
                       !status.toLowerCase().includes("not answered");
    
    if (currentQuestionType === "numerical") {
      // Numerical type
      if (givenAnswer && givenAnswer !== "--" && givenAnswer !== "-" && isAnswered) {
        const numValue = parseFloat(givenAnswer);
        if (!isNaN(numValue)) {
          responses.push({
            question_id: currentQuestionId,
            claimed_numeric_value: numValue,
            is_attempted: true,
          });
        } else {
          responses.push({
            question_id: currentQuestionId,
            is_attempted: false,
          });
        }
      } else {
        responses.push({
          question_id: currentQuestionId,
          is_attempted: false,
        });
      }
    } else {
      // MCQ type
      if (chosenOption && chosenOption !== "--" && chosenOption !== "-" && isAnswered) {
        const optionNum = parseInt(chosenOption, 10);
        if (optionNum >= 1 && optionNum <= 4 && optionIds[optionNum]) {
          responses.push({
            question_id: currentQuestionId,
            claimed_option_ids: [optionIds[optionNum]],
            is_attempted: true,
          });
        } else {
          // Chosen option is valid but we don't have the option ID
          // Try to use the option number as a letter (1=A, 2=B, etc.)
          const letterMap: Record<number, string> = { 1: "A", 2: "B", 3: "C", 4: "D" };
          if (optionNum >= 1 && optionNum <= 4) {
            responses.push({
              question_id: currentQuestionId,
              claimed_option_ids: [optionIds[optionNum] || letterMap[optionNum]],
              is_attempted: true,
            });
          } else {
            responses.push({
              question_id: currentQuestionId,
              is_attempted: false,
            });
          }
        }
      } else {
        responses.push({
          question_id: currentQuestionId,
          is_attempted: false,
        });
      }
    }

    // Reset for next question
    currentQuestionId = "";
    optionIds = {};
    status = "";
    chosenOption = "";
    givenAnswer = "";
  };

  for (const line of lines) {
    // Section detection
    if (line.toLowerCase().includes("section :") || line.toLowerCase().includes("section:")) {
      currentSubject = detectSubject(line);
      continue;
    }

    // Question Type detection (MCQ vs SA/Numerical)
    const typeMatch = line.match(/Question\s*Type\s*:\s*(MCQ|SA|Numerical)/i);
    if (typeMatch) {
      const qType = typeMatch[1].toLowerCase();
      currentQuestionType = qType === "sa" || qType === "numerical" ? "numerical" : "mcq_single";
      continue;
    }

    // Question ID detection
    const qIdMatch = line.match(/Question\s*ID\s*:\s*(\d+)/i);
    if (qIdMatch) {
      // Finalize previous question before starting new one
      finalizeQuestion();
      currentQuestionId = qIdMatch[1];
      continue;
    }

    // Option ID detection (Option 1 ID, Option 2 ID, etc.)
    const optMatch = line.match(/Option\s*(\d)\s*ID\s*:\s*(\d+)/i);
    if (optMatch) {
      const optNum = parseInt(optMatch[1], 10);
      optionIds[optNum] = optMatch[2];
      continue;
    }

    // Status detection
    const statusMatch = line.match(/Status\s*:\s*(.+)/i);
    if (statusMatch) {
      status = statusMatch[1].trim();
      continue;
    }

    // Chosen Option detection (for MCQ)
    const chosenMatch = line.match(/Chosen\s*Option\s*:\s*(\S+)/i);
    if (chosenMatch) {
      chosenOption = chosenMatch[1].trim();
      continue;
    }

    // Given Answer detection (for Numerical/SA)
    const givenMatch = line.match(/Given\s*Answer\s*:\s*(\S+)/i);
    if (givenMatch) {
      givenAnswer = givenMatch[1].trim();
      continue;
    }
  }

  // Finalize last question
  finalizeQuestion();

  return responses;
}

/**
 * Validate if the HTML looks like a Digialm response sheet
 */
export function isDigialmFormat(html: string): boolean {
  // Check for Digialm-specific markers
  const markers = [
    /Question\s*ID\s*:/i,
    /Option\s*\d\s*ID\s*:/i,
    /Chosen\s*Option\s*:/i,
    /digialm/i,
  ];

  const matchCount = markers.filter(pattern => pattern.test(html)).length;
  return matchCount >= 2;
}

/**
 * Get diagnostic info from HTML for debugging
 */
export function getDigialmDiagnostic(html: string): { 
  hasQuestionIds: boolean;
  hasOptionIds: boolean;
  hasChosenOptions: boolean;
  questionCount: number;
} {
  const questionMatches = html.match(/Question\s*ID\s*:\s*\d+/gi) || [];
  const optionMatches = html.match(/Option\s*\d\s*ID\s*:\s*\d+/gi) || [];
  const chosenMatches = html.match(/Chosen\s*Option\s*:/gi) || [];

  return {
    hasQuestionIds: questionMatches.length > 0,
    hasOptionIds: optionMatches.length > 0,
    hasChosenOptions: chosenMatches.length > 0,
    questionCount: questionMatches.length,
  };
}
