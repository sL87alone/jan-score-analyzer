export interface Test {
  id: string;
  name: string;
  shift: string;
  exam_date?: string;
  marking_rules_json: MarkingRules;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface MarkingRules {
  mcq_single: { correct: number; wrong: number; unattempted: number };
  msq: { correct: number; wrong: number; unattempted: number };
  numerical: { correct: number; wrong: number; unattempted: number };
}

export interface AnswerKey {
  id: string;
  test_id: string;
  question_id: string;
  subject: "Mathematics" | "Physics" | "Chemistry";
  question_type: "mcq_single" | "msq" | "numerical";
  correct_option_ids: string[] | null;
  correct_numeric_value: number | null;
  numeric_tolerance: number;
  is_cancelled: boolean;
  is_bonus: boolean;
  created_at: string;
}

export interface Submission {
  id: string;
  test_id: string | null;
  source_type: "url" | "html";
  share_enabled: boolean;
  share_token: string | null;
  user_id: string | null;
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
  created_at: string;
}

export interface Response {
  id: string;
  submission_id: string;
  question_id: string;
  claimed_option_ids: string[] | null;
  claimed_numeric_value: number | null;
  status: "correct" | "wrong" | "unattempted" | "cancelled";
  marks_awarded: number;
  subject: string | null;
  created_at: string;
}

export interface ParsedResponse {
  question_id: string;
  claimed_option_ids?: string[];
  claimed_numeric_value?: number;
  is_attempted: boolean;
}

export interface SubjectStats {
  subject: string;
  marks: number;
  attempted: number;
  correct: number;
  wrong: number;
  unattempted: number;
  accuracy: number;
}
