// Fixed exam dates for JEE Main January 2026
// ISO date values for internal use, display labels for UI

export interface ExamDateOption {
  value: string; // ISO format: YYYY-MM-DD
  label: string; // Display format: "21 January 2026"
}

export const EXAM_DATES: ExamDateOption[] = [
  { value: "2026-01-21", label: "21 January 2026" },
  { value: "2026-01-22", label: "22 January 2026" },
  { value: "2026-01-23", label: "23 January 2026" },
  { value: "2026-01-24", label: "24 January 2026" },
  { value: "2026-01-28", label: "28 January 2026" },
];

export const SHIFTS = ["Shift 1", "Shift 2"] as const;

export type ShiftType = (typeof SHIFTS)[number];

/**
 * Get display label for an ISO date string
 */
export const getExamDateLabel = (isoDate: string): string => {
  const found = EXAM_DATES.find((d) => d.value === isoDate);
  return found?.label || isoDate;
};
