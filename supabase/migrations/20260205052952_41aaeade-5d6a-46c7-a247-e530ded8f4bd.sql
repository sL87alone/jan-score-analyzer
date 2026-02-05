-- Add question_results_json column to submissions table for storing detailed question-level analysis
-- This column stores an array of question result objects with text, options, and answers
ALTER TABLE public.submissions 
ADD COLUMN IF NOT EXISTS question_results_json jsonb DEFAULT NULL;

-- Add a comment explaining the column structure
COMMENT ON COLUMN public.submissions.question_results_json IS 
'Stores per-question breakdown: [{question_id, qno, subject, section, attempted, is_correct, marks_awarded, negative, user_answer, correct_answer, question_text, options}]';

-- Note: This column is protected by existing RLS policies - only submission owner can SELECT their own data