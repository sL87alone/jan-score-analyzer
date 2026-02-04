/**
 * Normalization utilities for exam date and shift values
 * Use these functions everywhere to ensure consistent data storage and lookup
 */

export type ValidShift = "Shift 1" | "Shift 2";

const VALID_SHIFTS: ValidShift[] = ["Shift 1", "Shift 2"];

/**
 * Normalize a shift string to the canonical format
 * Handles variations like "shift 1", "S1", " Shift 1 ", etc.
 * 
 * @returns The normalized shift string or null if invalid
 */
export function normalizeShift(shift: string): ValidShift | null {
  if (!shift) return null;
  
  const trimmed = shift.trim();
  
  // Direct match (case-insensitive)
  for (const valid of VALID_SHIFTS) {
    if (trimmed.toLowerCase() === valid.toLowerCase()) {
      return valid;
    }
  }
  
  // Handle shorthand like "S1", "S2", "1", "2"
  const shorthandMatch = trimmed.match(/^(?:s(?:hift)?)?[\s-]*([12])$/i);
  if (shorthandMatch) {
    const num = shorthandMatch[1];
    return `Shift ${num}` as ValidShift;
  }
  
  return null;
}

/**
 * Normalize an exam date to ISO format (YYYY-MM-DD)
 * Handles various date formats and ensures consistent storage
 * 
 * @returns The normalized ISO date string or null if invalid
 */
export function normalizeExamDate(date: string | Date): string | null {
  if (!date) return null;
  
  try {
    let dateObj: Date;
    
    if (date instanceof Date) {
      dateObj = date;
    } else {
      const trimmed = date.trim();
      
      // Already in ISO format (YYYY-MM-DD)
      if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
        return trimmed;
      }
      
      // Parse other formats
      dateObj = new Date(trimmed);
    }
    
    if (isNaN(dateObj.getTime())) {
      return null;
    }
    
    // Return ISO format (YYYY-MM-DD)
    return dateObj.toISOString().split("T")[0];
  } catch {
    return null;
  }
}

/**
 * Validate that both exam date and shift are properly normalized
 * 
 * @returns Object with normalized values and validity flag
 */
export function normalizeTestIdentifier(examDate: string, shift: string): {
  valid: boolean;
  examDate: string | null;
  shift: ValidShift | null;
  error?: string;
} {
  const normalizedDate = normalizeExamDate(examDate);
  const normalizedShift = normalizeShift(shift);
  
  if (!normalizedDate) {
    return {
      valid: false,
      examDate: null,
      shift: null,
      error: `Invalid exam date format: "${examDate}"`,
    };
  }
  
  if (!normalizedShift) {
    return {
      valid: false,
      examDate: normalizedDate,
      shift: null,
      error: `Invalid shift format: "${shift}". Expected "Shift 1" or "Shift 2"`,
    };
  }
  
  return {
    valid: true,
    examDate: normalizedDate,
    shift: normalizedShift,
  };
}

/**
 * Create a unique key string for a test (for debugging/logging)
 */
export function getTestKey(examDate: string, shift: string): string {
  const normalized = normalizeTestIdentifier(examDate, shift);
  if (!normalized.valid) {
    return `invalid:${examDate}|${shift}`;
  }
  return `${normalized.examDate}|${normalized.shift}`;
}
