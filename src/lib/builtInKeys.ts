// Built-in answer keys for quick import
// These are embedded directly to avoid external dependencies

export interface BuiltInAnswerKey {
  question_id: string;
  type: "mcq_single" | "numerical";
  correct_option_ids?: string[];
  correct_numeric_value?: number;
  subject: "Mathematics" | "Physics" | "Chemistry";
}

export interface BuiltInKeySet {
  exam_date: string; // ISO format
  shift: string;
  label: string;
  keys: BuiltInAnswerKey[];
}

// 28 January 2026 - Shift 1
const KEY_2026_01_28_SHIFT_1: BuiltInAnswerKey[] = [
  // Mathematics (MCQ)
  { question_id: "444792676", type: "mcq_single", correct_option_ids: ["4447922297"], subject: "Mathematics" },
  { question_id: "444792677", type: "mcq_single", correct_option_ids: ["4447922302"], subject: "Mathematics" },
  { question_id: "444792678", type: "mcq_single", correct_option_ids: ["4447922306"], subject: "Mathematics" },
  { question_id: "444792679", type: "mcq_single", correct_option_ids: ["4447922310"], subject: "Mathematics" },
  { question_id: "444792680", type: "mcq_single", correct_option_ids: ["4447922312"], subject: "Mathematics" },
  { question_id: "444792681", type: "mcq_single", correct_option_ids: ["4447922317"], subject: "Mathematics" },
  { question_id: "444792682", type: "mcq_single", correct_option_ids: ["4447922321"], subject: "Mathematics" },
  { question_id: "444792683", type: "mcq_single", correct_option_ids: ["4447922326"], subject: "Mathematics" },
  { question_id: "444792684", type: "mcq_single", correct_option_ids: ["4447922328"], subject: "Mathematics" },
  { question_id: "444792685", type: "mcq_single", correct_option_ids: ["4447922334"], subject: "Mathematics" },
  { question_id: "444792686", type: "mcq_single", correct_option_ids: ["4447922337"], subject: "Mathematics" },
  { question_id: "444792687", type: "mcq_single", correct_option_ids: ["4447922342"], subject: "Mathematics" },
  { question_id: "444792688", type: "mcq_single", correct_option_ids: ["4447922344"], subject: "Mathematics" },
  { question_id: "444792689", type: "mcq_single", correct_option_ids: ["4447922350"], subject: "Mathematics" },
  { question_id: "444792690", type: "mcq_single", correct_option_ids: ["4447922354"], subject: "Mathematics" },
  { question_id: "444792691", type: "mcq_single", correct_option_ids: ["4447922357"], subject: "Mathematics" },
  { question_id: "444792692", type: "mcq_single", correct_option_ids: ["4447922361"], subject: "Mathematics" },
  { question_id: "444792693", type: "mcq_single", correct_option_ids: ["4447922364"], subject: "Mathematics" },
  { question_id: "444792694", type: "mcq_single", correct_option_ids: ["4447922370"], subject: "Mathematics" },
  { question_id: "444792695", type: "mcq_single", correct_option_ids: ["4447922373"], subject: "Mathematics" },
  // Mathematics (Numerical)
  { question_id: "444792696", type: "numerical", correct_numeric_value: 90, subject: "Mathematics" },
  { question_id: "444792697", type: "numerical", correct_numeric_value: 1, subject: "Mathematics" },
  { question_id: "444792698", type: "numerical", correct_numeric_value: 37, subject: "Mathematics" },
  { question_id: "444792699", type: "numerical", correct_numeric_value: 210, subject: "Mathematics" },
  { question_id: "444792700", type: "numerical", correct_numeric_value: 8, subject: "Mathematics" },

  // Physics (MCQ)
  { question_id: "444792701", type: "mcq_single", correct_option_ids: ["4447922383"], subject: "Physics" },
  { question_id: "444792702", type: "mcq_single", correct_option_ids: ["4447922386"], subject: "Physics" },
  { question_id: "444792703", type: "mcq_single", correct_option_ids: ["4447922390"], subject: "Physics" },
  { question_id: "444792704", type: "mcq_single", correct_option_ids: ["4447922393"], subject: "Physics" },
  { question_id: "444792705", type: "mcq_single", correct_option_ids: ["4447922399"], subject: "Physics" },
  { question_id: "444792706", type: "mcq_single", correct_option_ids: ["4447922403"], subject: "Physics" },
  { question_id: "444792707", type: "mcq_single", correct_option_ids: ["4447922408"], subject: "Physics" },
  { question_id: "444792708", type: "mcq_single", correct_option_ids: ["4447922412"], subject: "Physics" },
  { question_id: "444792709", type: "mcq_single", correct_option_ids: ["4447922414"], subject: "Physics" },
  { question_id: "444792710", type: "mcq_single", correct_option_ids: ["4447922417"], subject: "Physics" },
  { question_id: "444792711", type: "mcq_single", correct_option_ids: ["4447922421"], subject: "Physics" },
  { question_id: "444792712", type: "mcq_single", correct_option_ids: ["4447922427"], subject: "Physics" },
  { question_id: "444792713", type: "mcq_single", correct_option_ids: ["4447922431"], subject: "Physics" },
  { question_id: "444792714", type: "mcq_single", correct_option_ids: ["4447922436"], subject: "Physics" },
  { question_id: "444792715", type: "mcq_single", correct_option_ids: ["4447922440"], subject: "Physics" },
  { question_id: "444792716", type: "mcq_single", correct_option_ids: ["4447922441"], subject: "Physics" },
  { question_id: "444792717", type: "mcq_single", correct_option_ids: ["4447922447"], subject: "Physics" },
  { question_id: "444792718", type: "mcq_single", correct_option_ids: ["4447922449"], subject: "Physics" },
  { question_id: "444792719", type: "mcq_single", correct_option_ids: ["4447922455"], subject: "Physics" },
  { question_id: "444792720", type: "mcq_single", correct_option_ids: ["4447922460"], subject: "Physics" },
  // Physics (Numerical)
  { question_id: "444792721", type: "numerical", correct_numeric_value: 3, subject: "Physics" },
  { question_id: "444792722", type: "numerical", correct_numeric_value: 21, subject: "Physics" },
  { question_id: "444792723", type: "numerical", correct_numeric_value: 2, subject: "Physics" },
  { question_id: "444792724", type: "numerical", correct_numeric_value: 265, subject: "Physics" },
  { question_id: "444792725", type: "numerical", correct_numeric_value: 2, subject: "Physics" },

  // Chemistry (MCQ)
  { question_id: "444792726", type: "mcq_single", correct_option_ids: ["4447922467"], subject: "Chemistry" },
  { question_id: "444792727", type: "mcq_single", correct_option_ids: ["4447922472"], subject: "Chemistry" },
  { question_id: "444792728", type: "mcq_single", correct_option_ids: ["4447922475"], subject: "Chemistry" },
  { question_id: "444792729", type: "mcq_single", correct_option_ids: ["4447922480"], subject: "Chemistry" },
  { question_id: "444792730", type: "mcq_single", correct_option_ids: ["4447922483"], subject: "Chemistry" },
  { question_id: "444792731", type: "mcq_single", correct_option_ids: ["4447922489"], subject: "Chemistry" },
  { question_id: "444792732", type: "mcq_single", correct_option_ids: ["4447922491"], subject: "Chemistry" },
  { question_id: "444792733", type: "mcq_single", correct_option_ids: ["4447922495"], subject: "Chemistry" },
  { question_id: "444792734", type: "mcq_single", correct_option_ids: ["4447922501"], subject: "Chemistry" },
  { question_id: "444792735", type: "mcq_single", correct_option_ids: ["4447922502"], subject: "Chemistry" },
  { question_id: "444792736", type: "mcq_single", correct_option_ids: ["4447922507"], subject: "Chemistry" },
  { question_id: "444792737", type: "mcq_single", correct_option_ids: ["4447922512"], subject: "Chemistry" },
  { question_id: "444792738", type: "mcq_single", correct_option_ids: ["4447922517"], subject: "Chemistry" },
  { question_id: "444792739", type: "mcq_single", correct_option_ids: ["4447922520"], subject: "Chemistry" },
  { question_id: "444792740", type: "mcq_single", correct_option_ids: ["4447922522"], subject: "Chemistry" },
  { question_id: "444792741", type: "mcq_single", correct_option_ids: ["4447922529"], subject: "Chemistry" },
  { question_id: "444792742", type: "mcq_single", correct_option_ids: ["4447922531"], subject: "Chemistry" },
  { question_id: "444792743", type: "mcq_single", correct_option_ids: ["4447922537"], subject: "Chemistry" },
  { question_id: "444792744", type: "mcq_single", correct_option_ids: ["4447922538"], subject: "Chemistry" },
  { question_id: "444792745", type: "mcq_single", correct_option_ids: ["4447922542"], subject: "Chemistry" },
  // Chemistry (Numerical)
  { question_id: "444792746", type: "numerical", correct_numeric_value: 6, subject: "Chemistry" },
  { question_id: "444792747", type: "numerical", correct_numeric_value: 4, subject: "Chemistry" },
  { question_id: "444792748", type: "numerical", correct_numeric_value: 3, subject: "Chemistry" },
  { question_id: "444792749", type: "numerical", correct_numeric_value: 24, subject: "Chemistry" },
  { question_id: "444792750", type: "numerical", correct_numeric_value: 3, subject: "Chemistry" },
];

export const BUILT_IN_KEYS: BuiltInKeySet[] = [
  {
    exam_date: "2026-01-28",
    shift: "Shift 1",
    label: "28 January 2026 - Shift 1",
    keys: KEY_2026_01_28_SHIFT_1,
  },
];

export const getBuiltInKeyStats = (keys: BuiltInAnswerKey[]) => {
  const stats = {
    total: keys.length,
    mathematics: keys.filter((k) => k.subject === "Mathematics").length,
    physics: keys.filter((k) => k.subject === "Physics").length,
    chemistry: keys.filter((k) => k.subject === "Chemistry").length,
  };
  return stats;
};
