import { MarkingRules, ParsedResponse, Response, SubjectStats } from "./types";

interface AnswerKeyItem {
  question_id: string;
  subject: string;
  question_type: string;
  correct_option_ids: string[] | null;
  correct_numeric_value: number | null;
  numeric_tolerance: number;
  is_cancelled: boolean;
  is_bonus: boolean;
}

interface ScoringResult {
  responses: Omit<Response, "id" | "created_at">[];
  summary: {
    total_marks: number;
    total_attempted: number;
    total_correct: number;
    total_wrong: number;
    total_unattempted: number;
    accuracy_percentage: number;
    negative_marks: number;
    math_marks: number;
    physics_marks: number;
    chemistry_marks: number;
  };
  subjectStats: SubjectStats[];
}

export function calculateScores(
  parsedResponses: ParsedResponse[],
  answerKeys: AnswerKeyItem[],
  markingRules: MarkingRules,
  submissionId: string
): ScoringResult {
  const responses: Omit<Response, "id" | "created_at">[] = [];
  
  let totalMarks = 0;
  let totalAttempted = 0;
  let totalCorrect = 0;
  let totalWrong = 0;
  let totalUnattempted = 0;
  let negativeMarks = 0;

  const subjectScores: Record<string, { marks: number; attempted: number; correct: number; wrong: number; unattempted: number }> = {
    Mathematics: { marks: 0, attempted: 0, correct: 0, wrong: 0, unattempted: 0 },
    Physics: { marks: 0, attempted: 0, correct: 0, wrong: 0, unattempted: 0 },
    Chemistry: { marks: 0, attempted: 0, correct: 0, wrong: 0, unattempted: 0 },
  };

  // Create a map for quick answer key lookup
  const answerKeyMap = new Map<string, AnswerKeyItem>();
  answerKeys.forEach((key) => {
    answerKeyMap.set(key.question_id, key);
  });

  // Process each parsed response
  parsedResponses.forEach((parsed) => {
    const answerKey = answerKeyMap.get(parsed.question_id);
    
    if (!answerKey) {
      // Question not found in answer key, skip
      return;
    }

    const subject = answerKey.subject;
    const questionType = answerKey.question_type;
    const rules = markingRules[questionType];

    let status: "correct" | "wrong" | "unattempted" | "cancelled" = "unattempted";
    let marksAwarded = 0;

    // Handle cancelled questions
    if (answerKey.is_cancelled) {
      status = "cancelled";
      marksAwarded = 0;
    }
    // Handle bonus questions
    else if (answerKey.is_bonus) {
      if (parsed.is_attempted) {
        const isCorrect = checkAnswer(parsed, answerKey);
        if (isCorrect) {
          status = "correct";
          marksAwarded = rules.correct;
        } else {
          // Bonus questions don't give negative marks
          status = "wrong";
          marksAwarded = 0;
        }
      } else {
        // Bonus questions give marks even if unattempted
        status = "correct";
        marksAwarded = rules.correct;
      }
    }
    // Normal questions
    else if (!parsed.is_attempted) {
      status = "unattempted";
      marksAwarded = rules.unattempted;
      totalUnattempted++;
      subjectScores[subject].unattempted++;
    } else {
      totalAttempted++;
      subjectScores[subject].attempted++;
      
      const isCorrect = checkAnswer(parsed, answerKey);
      
      if (isCorrect) {
        status = "correct";
        marksAwarded = rules.correct;
        totalCorrect++;
        subjectScores[subject].correct++;
      } else {
        status = "wrong";
        marksAwarded = rules.wrong;
        totalWrong++;
        subjectScores[subject].wrong++;
        negativeMarks += Math.abs(rules.wrong);
      }
    }

    totalMarks += marksAwarded;
    subjectScores[subject].marks += marksAwarded;

    responses.push({
      submission_id: submissionId,
      question_id: parsed.question_id,
      claimed_option_ids: parsed.claimed_option_ids || null,
      claimed_numeric_value: parsed.claimed_numeric_value ?? null,
      status,
      marks_awarded: marksAwarded,
      subject,
    });
  });

  const accuracyPercentage = totalAttempted > 0 
    ? Math.round((totalCorrect / totalAttempted) * 100 * 100) / 100 
    : 0;

  const subjectStats: SubjectStats[] = Object.entries(subjectScores).map(([subject, stats]) => ({
    subject,
    marks: stats.marks,
    attempted: stats.attempted,
    correct: stats.correct,
    wrong: stats.wrong,
    unattempted: stats.unattempted,
    accuracy: stats.attempted > 0 
      ? Math.round((stats.correct / stats.attempted) * 100 * 100) / 100 
      : 0,
  }));

  return {
    responses,
    summary: {
      total_marks: totalMarks,
      total_attempted: totalAttempted,
      total_correct: totalCorrect,
      total_wrong: totalWrong,
      total_unattempted: totalUnattempted,
      accuracy_percentage: accuracyPercentage,
      negative_marks: negativeMarks,
      math_marks: subjectScores.Mathematics.marks,
      physics_marks: subjectScores.Physics.marks,
      chemistry_marks: subjectScores.Chemistry.marks,
    },
    subjectStats,
  };
}

function checkAnswer(parsed: ParsedResponse, answerKey: AnswerKeyItem): boolean {
  if (answerKey.question_type === "numerical") {
    if (parsed.claimed_numeric_value === undefined) return false;
    if (answerKey.correct_numeric_value === null) return false;
    
    const tolerance = answerKey.numeric_tolerance || 0;
    const diff = Math.abs(parsed.claimed_numeric_value - answerKey.correct_numeric_value);
    return diff <= tolerance;
  }

  // MCQ single or MSQ
  if (!parsed.claimed_option_ids || !answerKey.correct_option_ids) return false;

  const claimed = [...parsed.claimed_option_ids].sort().join(",");
  const correct = [...answerKey.correct_option_ids].sort().join(",");
  
  return claimed === correct;
}
