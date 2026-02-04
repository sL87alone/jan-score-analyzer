-- Add unique constraint for (exam_date, shift) combination
-- This ensures no duplicate tests for the same date and shift
ALTER TABLE public.tests
ADD CONSTRAINT tests_exam_date_shift_unique UNIQUE (exam_date, shift);

-- Update shift column to only allow 'Shift 1' or 'Shift 2' values
-- We use a check constraint for this
ALTER TABLE public.tests
ADD CONSTRAINT tests_shift_valid CHECK (shift IN ('Shift 1', 'Shift 2'));

-- Make exam_date required for new tests (update existing nulls first if any)
-- Note: We're not making it NOT NULL immediately since existing records might have null