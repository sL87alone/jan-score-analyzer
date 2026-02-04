/**
 * Section-wise breakdown computation (Section A = MCQ, Section B = Numerical)
 * Computes stats from scored responses and answer key metadata.
 */

import { Response as ResponseType } from "./types";

export interface SectionStats {
  attempted: number;
  correct: number;
  wrong: number;
  negative: number;
  marks: number;
  marksLost: number; // For numerical: (attempted - correct) * 4
  total: number;
}

export interface SectionBreakdown {
  A: SectionStats; // MCQ
  B: SectionStats; // Numerical
}

export interface SubjectSectionBreakdown {
  [subject: string]: SectionBreakdown;
}

const NUMERICAL_TYPES = ["numerical", "integer", "num"];

/**
 * Determine if a question type is numerical (Section B)
 */
export function isNumericalType(questionType: string): boolean {
  return NUMERICAL_TYPES.includes(questionType.toLowerCase());
}

/**
 * Compute section-wise breakdown from responses
 * Requires question_type from answer_keys to be joined with responses
 */
export function computeSectionStats(
  responses: (ResponseType & { question_type?: string })[],
  answerKeyMap?: Map<string, { question_type: string }>
): SectionBreakdown {
  const stats: SectionBreakdown = {
    A: { attempted: 0, correct: 0, wrong: 0, negative: 0, marks: 0, marksLost: 0, total: 0 },
    B: { attempted: 0, correct: 0, wrong: 0, negative: 0, marks: 0, marksLost: 0, total: 0 },
  };

  responses.forEach((r) => {
    // Get question type from response or answer key map
    let qType = r.question_type;
    if (!qType && answerKeyMap) {
      const key = answerKeyMap.get(String(r.question_id));
      qType = key?.question_type;
    }

    const section = qType && isNumericalType(qType) ? "B" : "A";
    const s = stats[section];

    s.total++;

    if (r.status === "correct") {
      s.attempted++;
      s.correct++;
      s.marks += r.marks_awarded || 0;
    } else if (r.status === "wrong") {
      s.attempted++;
      s.wrong++;
      const awarded = r.marks_awarded || 0;
      s.marks += awarded;
      if (awarded < 0) {
        s.negative += Math.abs(awarded);
      }
    }
    // unattempted: no change to attempted count
  });

  // Compute marks lost for Section B (Numerical)
  // Marks lost = (attempted - correct) * 4 (missed +4s due to no negative)
  stats.B.marksLost = (stats.B.attempted - stats.B.correct) * 4;

  return stats;
}

/**
 * Compute section-wise breakdown per subject
 */
export function computeSubjectSectionStats(
  responses: (ResponseType & { question_type?: string })[],
  answerKeyMap?: Map<string, { question_type: string; subject: string }>
): SubjectSectionBreakdown {
  const result: SubjectSectionBreakdown = {
    Mathematics: {
      A: { attempted: 0, correct: 0, wrong: 0, negative: 0, marks: 0, marksLost: 0, total: 0 },
      B: { attempted: 0, correct: 0, wrong: 0, negative: 0, marks: 0, marksLost: 0, total: 0 },
    },
    Physics: {
      A: { attempted: 0, correct: 0, wrong: 0, negative: 0, marks: 0, marksLost: 0, total: 0 },
      B: { attempted: 0, correct: 0, wrong: 0, negative: 0, marks: 0, marksLost: 0, total: 0 },
    },
    Chemistry: {
      A: { attempted: 0, correct: 0, wrong: 0, negative: 0, marks: 0, marksLost: 0, total: 0 },
      B: { attempted: 0, correct: 0, wrong: 0, negative: 0, marks: 0, marksLost: 0, total: 0 },
    },
  };

  responses.forEach((r) => {
    // Get subject and type from answer key map
    let subject = r.subject || "Unknown";
    let qType = r.question_type;

    if (answerKeyMap) {
      const key = answerKeyMap.get(String(r.question_id));
      if (key) {
        subject = key.subject || subject;
        qType = key.question_type || qType;
      }
    }

    // Skip unknown subjects
    if (!result[subject]) return;

    const section = qType && isNumericalType(qType) ? "B" : "A";
    const s = result[subject][section];

    s.total++;

    if (r.status === "correct") {
      s.attempted++;
      s.correct++;
      s.marks += r.marks_awarded || 0;
    } else if (r.status === "wrong") {
      s.attempted++;
      s.wrong++;
      const awarded = r.marks_awarded || 0;
      s.marks += awarded;
      if (awarded < 0) {
        s.negative += Math.abs(awarded);
      }
    }
  });

  // Compute marks lost for Section B in each subject
  Object.values(result).forEach((subj) => {
    subj.B.marksLost = (subj.B.attempted - subj.B.correct) * 4;
  });

  return result;
}
