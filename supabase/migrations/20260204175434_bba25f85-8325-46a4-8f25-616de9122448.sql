-- =============================================
-- FIX 1: Lock down submissions table completely
-- =============================================

-- Drop existing permissive policies that allow public access
DROP POLICY IF EXISTS "Users can view own submissions" ON public.submissions;
DROP POLICY IF EXISTS "Users can create own submissions" ON public.submissions;
DROP POLICY IF EXISTS "Users can update own submissions" ON public.submissions;
DROP POLICY IF EXISTS "Users can delete own submissions" ON public.submissions;
DROP POLICY IF EXISTS "Admins can manage all submissions" ON public.submissions;

-- Create strict owner-only policies (NO public access via share_enabled)
CREATE POLICY "Users can view own submissions"
ON public.submissions FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage all submissions"
ON public.submissions FOR ALL
USING (public.is_admin());

-- INSERT: Only authenticated users can create submissions for themselves
-- Edge function uses service role so bypasses RLS anyway
CREATE POLICY "Users can create own submissions"
ON public.submissions FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL AND (user_id IS NULL OR user_id = auth.uid()));

-- UPDATE: Only owner can update, explicitly exclude NULL user_id
CREATE POLICY "Users can update own submissions"
ON public.submissions FOR UPDATE
USING (auth.uid() = user_id AND user_id IS NOT NULL)
WITH CHECK (auth.uid() = user_id AND user_id IS NOT NULL);

-- DELETE: Only owner can delete, explicitly exclude NULL user_id
CREATE POLICY "Users can delete own submissions"
ON public.submissions FOR DELETE
USING (auth.uid() = user_id AND user_id IS NOT NULL);

-- =============================================
-- FIX 2: Lock down responses table similarly
-- =============================================

DROP POLICY IF EXISTS "Users can view responses of own or shared submissions" ON public.responses;
DROP POLICY IF EXISTS "Users can create responses for own submissions" ON public.responses;
DROP POLICY IF EXISTS "Users can delete responses of own submissions" ON public.responses;
DROP POLICY IF EXISTS "Admins can manage all responses" ON public.responses;

-- Responses only visible to submission owner
CREATE POLICY "Users can view responses of own submissions"
ON public.responses FOR SELECT
USING (EXISTS (
  SELECT 1 FROM public.submissions s
  WHERE s.id = responses.submission_id
  AND s.user_id = auth.uid()
));

CREATE POLICY "Admins can manage all responses"
ON public.responses FOR ALL
USING (public.is_admin());

-- INSERT: Only for own submissions (edge function bypasses anyway)
CREATE POLICY "Users can create responses for own submissions"
ON public.responses FOR INSERT
WITH CHECK (EXISTS (
  SELECT 1 FROM public.submissions s
  WHERE s.id = responses.submission_id
  AND (s.user_id = auth.uid() OR s.user_id IS NULL)
));

-- DELETE: Only owner can delete
CREATE POLICY "Users can delete responses of own submissions"
ON public.responses FOR DELETE
USING (EXISTS (
  SELECT 1 FROM public.submissions s
  WHERE s.id = responses.submission_id
  AND s.user_id = auth.uid()
));

-- =============================================
-- FIX 3: Lock down tests table (no public marking rules)
-- =============================================

DROP POLICY IF EXISTS "Anyone can view active tests" ON public.tests;
DROP POLICY IF EXISTS "Admins can manage tests" ON public.tests;

-- Only authenticated users can see tests (and only active ones)
CREATE POLICY "Authenticated users can view active tests"
ON public.tests FOR SELECT
TO authenticated
USING (is_active = true);

-- Admins can manage all tests
CREATE POLICY "Admins can manage tests"
ON public.tests FOR ALL
USING (public.is_admin());

-- =============================================
-- FIX 4: Create secure RPC for public share access
-- =============================================

-- Return type for public report
CREATE TYPE public.public_report_data AS (
  id uuid,
  test_name text,
  test_shift text,
  exam_date date,
  total_marks numeric,
  total_attempted integer,
  total_correct integer,
  total_wrong integer,
  total_unattempted integer,
  accuracy_percentage numeric,
  negative_marks numeric,
  math_marks numeric,
  physics_marks numeric,
  chemistry_marks numeric,
  created_at timestamptz
);

-- Security definer function to get public report via share token
CREATE OR REPLACE FUNCTION public.get_public_report(p_share_token text)
RETURNS public.public_report_data
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    s.id,
    t.name as test_name,
    t.shift as test_shift,
    t.exam_date,
    s.total_marks,
    s.total_attempted,
    s.total_correct,
    s.total_wrong,
    s.total_unattempted,
    s.accuracy_percentage,
    s.negative_marks,
    s.math_marks,
    s.physics_marks,
    s.chemistry_marks,
    s.created_at
  FROM public.submissions s
  LEFT JOIN public.tests t ON t.id = s.test_id
  WHERE s.share_enabled = true 
    AND s.share_token = p_share_token
    AND s.share_token IS NOT NULL
  LIMIT 1
$$;

-- Grant execute to both anon and authenticated
GRANT EXECUTE ON FUNCTION public.get_public_report(text) TO anon;
GRANT EXECUTE ON FUNCTION public.get_public_report(text) TO authenticated;

-- =============================================
-- FIX 5: Create RPC for public test list (without marking rules)
-- =============================================

-- Return type for public test info (no marking rules exposed)
CREATE TYPE public.public_test_info AS (
  id uuid,
  name text,
  shift text,
  exam_date date,
  is_active boolean
);

-- Security definer function to get active tests without marking rules
CREATE OR REPLACE FUNCTION public.get_active_tests()
RETURNS SETOF public.public_test_info
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    id,
    name,
    shift,
    exam_date,
    is_active
  FROM public.tests
  WHERE is_active = true
  ORDER BY exam_date DESC, shift ASC
$$;

-- Grant execute to anon for landing page test selection
GRANT EXECUTE ON FUNCTION public.get_active_tests() TO anon;
GRANT EXECUTE ON FUNCTION public.get_active_tests() TO authenticated;