/**
 * Percentile estimation for JEE Main based on Jan 2025 marks vs percentile data.
 * Uses 2026→2025 shift mapping and linear interpolation.
 */

// 2026 exam shift → 2025 shift mapping (exact from requirements)
export const MAP_2026_TO_2025: Record<string, string> = {
  "2026-01-24_S2": "2025-01-28_S1",
  "2026-01-23_S2": "2025-01-22_S1",
  "2026-01-22_S2": "2025-01-28_S2",
  "2026-01-23_S1": "2025-01-29_S1",
  "2026-01-22_S1": "2025-01-29_S2",
  "2026-01-24_S1": "2025-01-28_S1",
  "2026-01-28_S1": "2025-01-24_S1",
  "2026-01-21_S1": "2025-01-22_S2",
  "2026-01-21_S2": "2025-01-23_S2",
  "2026-01-28_S2": "2025-01-24_S2",
};

interface PercentilePoint {
  p: number;
  marks: number;
}

// Percentile data transcribed from Jan 2025 official results
export const PERCENTILE_TABLE_2025: Record<string, PercentilePoint[]> = {
  "2025-01-22_S1": [
    { p: 90, marks: 74 }, { p: 91, marks: 78 }, { p: 92, marks: 83 }, { p: 93, marks: 88 },
    { p: 94, marks: 94 }, { p: 95, marks: 101 }, { p: 95.5, marks: 105 }, { p: 96, marks: 110 },
    { p: 96.5, marks: 115 }, { p: 97, marks: 120 }, { p: 97.5, marks: 126 }, { p: 98, marks: 135 },
    { p: 98.5, marks: 144 }, { p: 99, marks: 158 }, { p: 99.1, marks: 160 }, { p: 99.2, marks: 164 },
    { p: 99.3, marks: 170 }, { p: 99.4, marks: 175 }, { p: 99.5, marks: 180 }, { p: 99.6, marks: 186 },
    { p: 99.7, marks: 196 }, { p: 99.8, marks: 205 }, { p: 99.9, marks: 224 },
  ],
  "2025-01-22_S2": [
    { p: 90, marks: 98 }, { p: 91, marks: 103 }, { p: 92, marks: 108 }, { p: 93, marks: 115 },
    { p: 94, marks: 122 }, { p: 95, marks: 129 }, { p: 95.5, marks: 134 }, { p: 96, marks: 138 },
    { p: 96.5, marks: 143 }, { p: 97, marks: 149 }, { p: 97.5, marks: 155 }, { p: 98, marks: 163 },
    { p: 98.5, marks: 173 }, { p: 99, marks: 186 }, { p: 99.1, marks: 189 }, { p: 99.2, marks: 192 },
    { p: 99.3, marks: 196 }, { p: 99.4, marks: 200 }, { p: 99.5, marks: 206 }, { p: 99.6, marks: 211 },
    { p: 99.7, marks: 219 }, { p: 99.8, marks: 228 }, { p: 99.9, marks: 243 },
  ],
  "2025-01-23_S1": [
    { p: 90, marks: 90 }, { p: 91, marks: 95 }, { p: 92, marks: 101 }, { p: 93, marks: 106 },
    { p: 94, marks: 112 }, { p: 95, marks: 120 }, { p: 95.5, marks: 124 }, { p: 96, marks: 129 },
    { p: 96.5, marks: 134 }, { p: 97, marks: 140 }, { p: 97.5, marks: 145 }, { p: 98, marks: 154 },
    { p: 98.5, marks: 165 }, { p: 99, marks: 178 }, { p: 99.1, marks: 181 }, { p: 99.2, marks: 185 },
    { p: 99.3, marks: 189 }, { p: 99.4, marks: 193 }, { p: 99.5, marks: 199 }, { p: 99.6, marks: 204 },
    { p: 99.7, marks: 211 }, { p: 99.8, marks: 221 }, { p: 99.9, marks: 236 },
  ],
  "2025-01-23_S2": [
    { p: 90, marks: 101 }, { p: 91, marks: 106 }, { p: 92, marks: 111 }, { p: 93, marks: 118 },
    { p: 94, marks: 124 }, { p: 95, marks: 132 }, { p: 95.5, marks: 136 }, { p: 96, marks: 141 },
    { p: 96.5, marks: 146 }, { p: 97, marks: 152 }, { p: 97.5, marks: 158 }, { p: 98, marks: 165 },
    { p: 98.5, marks: 175 }, { p: 99, marks: 187 }, { p: 99.1, marks: 190 }, { p: 99.2, marks: 193 },
    { p: 99.3, marks: 198 }, { p: 99.4, marks: 203 }, { p: 99.5, marks: 209 }, { p: 99.6, marks: 216 },
    { p: 99.7, marks: 225 }, { p: 99.8, marks: 236 }, { p: 99.9, marks: 253 },
  ],
  "2025-01-24_S1": [
    { p: 90, marks: 86 }, { p: 91, marks: 91 }, { p: 92, marks: 97 }, { p: 93, marks: 104 },
    { p: 94, marks: 111 }, { p: 95, marks: 121 }, { p: 95.5, marks: 126 }, { p: 96, marks: 131 },
    { p: 96.5, marks: 137 }, { p: 97, marks: 143 }, { p: 97.5, marks: 150 }, { p: 98, marks: 158 },
    { p: 98.5, marks: 168 }, { p: 99, marks: 181 }, { p: 99.1, marks: 184 }, { p: 99.2, marks: 189 },
    { p: 99.3, marks: 193 }, { p: 99.4, marks: 197 }, { p: 99.5, marks: 203 }, { p: 99.6, marks: 209 },
    { p: 99.7, marks: 216 }, { p: 99.8, marks: 225 }, { p: 99.9, marks: 239 },
  ],
  "2025-01-24_S2": [
    { p: 90, marks: 110 }, { p: 91, marks: 115 }, { p: 92, marks: 121 }, { p: 93, marks: 127 },
    { p: 94, marks: 134 }, { p: 95, marks: 142 }, { p: 95.5, marks: 147 }, { p: 96, marks: 151 },
    { p: 96.5, marks: 156 }, { p: 97, marks: 162 }, { p: 97.5, marks: 168 }, { p: 98, marks: 177 },
    { p: 98.5, marks: 186 }, { p: 99, marks: 200 }, { p: 99.1, marks: 203 }, { p: 99.2, marks: 207 },
    { p: 99.3, marks: 211 }, { p: 99.4, marks: 216 }, { p: 99.5, marks: 221 }, { p: 99.6, marks: 227 },
    { p: 99.7, marks: 234 }, { p: 99.8, marks: 246 }, { p: 99.9, marks: 260 },
  ],
  "2025-01-28_S1": [
    { p: 90, marks: 72 }, { p: 91, marks: 76 }, { p: 92, marks: 80 }, { p: 93, marks: 85 },
    { p: 94, marks: 90 }, { p: 95, marks: 96 }, { p: 95.5, marks: 100 }, { p: 96, marks: 105 },
    { p: 96.5, marks: 109 }, { p: 97, marks: 114 }, { p: 97.5, marks: 120 }, { p: 98, marks: 127 },
    { p: 98.5, marks: 136 }, { p: 99, marks: 148 }, { p: 99.1, marks: 151 }, { p: 99.2, marks: 155 },
    { p: 99.3, marks: 159 }, { p: 99.4, marks: 164 }, { p: 99.5, marks: 169 }, { p: 99.6, marks: 175 },
    { p: 99.7, marks: 183 }, { p: 99.8, marks: 195 }, { p: 99.9, marks: 214 },
  ],
  "2025-01-28_S2": [
    { p: 90, marks: 90 }, { p: 91, marks: 95 }, { p: 92, marks: 99 }, { p: 93, marks: 105 },
    { p: 94, marks: 111 }, { p: 95, marks: 118 }, { p: 95.5, marks: 121 }, { p: 96, marks: 126 },
    { p: 96.5, marks: 131 }, { p: 97, marks: 136 }, { p: 97.5, marks: 142 }, { p: 98, marks: 149 },
    { p: 98.5, marks: 159 }, { p: 99, marks: 171 }, { p: 99.1, marks: 174 }, { p: 99.2, marks: 178 },
    { p: 99.3, marks: 182 }, { p: 99.4, marks: 187 }, { p: 99.5, marks: 192 }, { p: 99.6, marks: 198 },
    { p: 99.7, marks: 207 }, { p: 99.8, marks: 216 }, { p: 99.9, marks: 235 },
  ],
  "2025-01-29_S1": [
    { p: 90, marks: 94 }, { p: 91, marks: 99 }, { p: 92, marks: 104 }, { p: 93, marks: 110 },
    { p: 94, marks: 116 }, { p: 95, marks: 123 }, { p: 95.5, marks: 126 }, { p: 96, marks: 130 },
    { p: 96.5, marks: 135 }, { p: 97, marks: 140 }, { p: 97.5, marks: 146 }, { p: 98, marks: 153 },
    { p: 98.5, marks: 162 }, { p: 99, marks: 174 }, { p: 99.1, marks: 176 }, { p: 99.2, marks: 179 },
    { p: 99.3, marks: 183 }, { p: 99.4, marks: 187 }, { p: 99.5, marks: 192 }, { p: 99.6, marks: 197 },
    { p: 99.7, marks: 204 }, { p: 99.8, marks: 214 }, { p: 99.9, marks: 230 },
  ],
  "2025-01-29_S2": [
    { p: 90, marks: 101 }, { p: 91, marks: 105 }, { p: 92, marks: 109 }, { p: 93, marks: 115 },
    { p: 94, marks: 120 }, { p: 95, marks: 127 }, { p: 95.5, marks: 130 }, { p: 96, marks: 134 },
    { p: 96.5, marks: 139 }, { p: 97, marks: 144 }, { p: 97.5, marks: 149 }, { p: 98, marks: 156 },
    { p: 98.5, marks: 165 }, { p: 99, marks: 176 }, { p: 99.1, marks: 179 }, { p: 99.2, marks: 183 },
    { p: 99.3, marks: 186 }, { p: 99.4, marks: 190 }, { p: 99.5, marks: 194 }, { p: 99.6, marks: 200 },
    { p: 99.7, marks: 207 }, { p: 99.8, marks: 216 }, { p: 99.9, marks: 230 },
  ],
};

/**
 * Convert exam_date (YYYY-MM-DD) and shift ("Shift 1" / "Shift 2") to key format
 */
export function formatShiftKey(examDate: string, shift: string): string {
  const shiftCode = shift === "Shift 1" ? "S1" : "S2";
  return `${examDate}_${shiftCode}`;
}

/**
 * Get the mapped 2025 shift key from a 2026 exam date and shift
 */
export function getMapped2025Shift(examDate: string, shift: string): string | null {
  const key2026 = formatShiftKey(examDate, shift);
  return MAP_2026_TO_2025[key2026] || null;
}

/**
 * Format the 2025 shift key for display (e.g., "2025-01-28_S1" → "28 Jan 2025 Shift 1")
 */
export function formatShiftKeyForDisplay(shiftKey: string): string {
  const [date, shiftCode] = shiftKey.split("_");
  const [year, month, day] = date.split("-");
  const months = ["", "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const shiftName = shiftCode === "S1" ? "Shift 1" : "Shift 2";
  return `${parseInt(day)} ${months[parseInt(month)]} ${year} ${shiftName}`;
}

export interface PercentileResult {
  percentile: number | null;
  displayValue: string;
  mapped2025Shift: string | null;
  mapped2025ShiftDisplay: string | null;
  isBelow: boolean;
  isAbove: boolean;
}

/**
 * Estimate percentile from marks using linear interpolation
 */
export function estimatePercentile(
  marks: number,
  examDate: string,
  shift: string
): PercentileResult {
  const mapped = getMapped2025Shift(examDate, shift);
  
  if (!mapped) {
    return {
      percentile: null,
      displayValue: "N/A",
      mapped2025Shift: null,
      mapped2025ShiftDisplay: null,
      isBelow: false,
      isAbove: false,
    };
  }

  const table = PERCENTILE_TABLE_2025[mapped];
  if (!table || table.length === 0) {
    return {
      percentile: null,
      displayValue: "N/A",
      mapped2025Shift: mapped,
      mapped2025ShiftDisplay: formatShiftKeyForDisplay(mapped),
      isBelow: false,
      isAbove: false,
    };
  }

  // Sort by marks ascending
  const sorted = [...table].sort((a, b) => a.marks - b.marks);
  const minMarks = sorted[0].marks;
  const maxMarks = sorted[sorted.length - 1].marks;
  const minPercentile = sorted[0].p;
  const maxPercentile = sorted[sorted.length - 1].p;

  // Below minimum
  if (marks < minMarks) {
    return {
      percentile: minPercentile,
      displayValue: `< ${minPercentile}`,
      mapped2025Shift: mapped,
      mapped2025ShiftDisplay: formatShiftKeyForDisplay(mapped),
      isBelow: true,
      isAbove: false,
    };
  }

  // Above maximum
  if (marks > maxMarks) {
    return {
      percentile: maxPercentile,
      displayValue: `> ${maxPercentile}`,
      mapped2025Shift: mapped,
      mapped2025ShiftDisplay: formatShiftKeyForDisplay(mapped),
      isBelow: false,
      isAbove: true,
    };
  }

  // Find bounding points and interpolate
  for (let i = 0; i < sorted.length - 1; i++) {
    const p1 = sorted[i];
    const p2 = sorted[i + 1];

    if (marks >= p1.marks && marks <= p2.marks) {
      // Linear interpolation: p = p1 + (marks - m1) * (p2 - p1) / (m2 - m1)
      const ratio = (marks - p1.marks) / (p2.marks - p1.marks);
      const percentile = p1.p + ratio * (p2.p - p1.p);
      const rounded = Math.round(percentile * 100) / 100;

      return {
        percentile: rounded,
        displayValue: rounded.toFixed(2),
        mapped2025Shift: mapped,
        mapped2025ShiftDisplay: formatShiftKeyForDisplay(mapped),
        isBelow: false,
        isAbove: false,
      };
    }
  }

  // Exact match with last point
  return {
    percentile: maxPercentile,
    displayValue: maxPercentile.toString(),
    mapped2025Shift: mapped,
    mapped2025ShiftDisplay: formatShiftKeyForDisplay(mapped),
    isBelow: false,
    isAbove: false,
  };
}
