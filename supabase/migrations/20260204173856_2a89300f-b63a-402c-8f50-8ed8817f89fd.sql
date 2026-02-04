-- =============================================
-- FIX SECURITY: answer_keys & submissions tables
-- =============================================

-- 1) ANSWER_KEYS: Remove public SELECT policy
DROP POLICY IF EXISTS "Anyone can view answer keys" ON public.answer_keys;

-- Ensure admin-only policies exist for answer_keys (recreate to be safe)
DROP POLICY IF EXISTS "Admins can delete answer keys" ON public.answer_keys;
DROP POLICY IF EXISTS "Admins can insert answer keys" ON public.answer_keys;
DROP POLICY IF EXISTS "Admins can update answer keys" ON public.answer_keys;
DROP POLICY IF EXISTS "Admins can select answer keys" ON public.answer_keys;

CREATE POLICY "Admins can select answer keys"
ON public.answer_keys FOR SELECT
USING (public.is_admin());

CREATE POLICY "Admins can insert answer keys"
ON public.answer_keys FOR INSERT
WITH CHECK (public.is_admin());

CREATE POLICY "Admins can update answer keys"
ON public.answer_keys FOR UPDATE
USING (public.is_admin());

CREATE POLICY "Admins can delete answer keys"
ON public.answer_keys FOR DELETE
USING (public.is_admin());

-- 2) SUBMISSIONS: Add user_id column for ownership tracking
ALTER TABLE public.submissions 
ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;

-- Add share_token for public sharing
ALTER TABLE public.submissions
ADD COLUMN IF NOT EXISTS share_token text UNIQUE;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_submissions_user_id ON public.submissions(user_id);
CREATE INDEX IF NOT EXISTS idx_submissions_share_token ON public.submissions(share_token);

-- 3) SUBMISSIONS: Drop overly permissive policies
DROP POLICY IF EXISTS "Anyone can create submissions" ON public.submissions;
DROP POLICY IF EXISTS "Anyone can update submissions" ON public.submissions;
DROP POLICY IF EXISTS "Anyone can delete submissions" ON public.submissions;
DROP POLICY IF EXISTS "Anyone can view submissions" ON public.submissions;
DROP POLICY IF EXISTS "Admins can manage all submissions" ON public.submissions;

-- 4) SUBMISSIONS: Create secure owner-based policies

-- SELECT: Owner can view their own, OR anyone can view if share_enabled
CREATE POLICY "Users can view own submissions"
ON public.submissions FOR SELECT
USING (
  auth.uid() = user_id 
  OR share_enabled = true
);

-- INSERT: Only authenticated users, and they must set user_id to their own id
CREATE POLICY "Users can create own submissions"
ON public.submissions FOR INSERT
WITH CHECK (
  auth.uid() IS NOT NULL 
  AND (user_id IS NULL OR user_id = auth.uid())
);

-- UPDATE: Only owner can update their submission
CREATE POLICY "Users can update own submissions"
ON public.submissions FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- DELETE: Only owner can delete their submission
CREATE POLICY "Users can delete own submissions"
ON public.submissions FOR DELETE
USING (auth.uid() = user_id);

-- Admins can manage all submissions
CREATE POLICY "Admins can manage all submissions"
ON public.submissions FOR ALL
USING (public.is_admin());

-- 5) RESPONSES: Update to allow viewing responses for shared submissions
DROP POLICY IF EXISTS "Anyone can view responses of shared submissions" ON public.responses;
DROP POLICY IF EXISTS "Anyone can create responses" ON public.responses;
DROP POLICY IF EXISTS "Anyone can delete responses" ON public.responses;

-- Responses follow submission ownership
CREATE POLICY "Users can view responses of own or shared submissions"
ON public.responses FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.submissions s
    WHERE s.id = responses.submission_id
    AND (s.user_id = auth.uid() OR s.share_enabled = true)
  )
);

CREATE POLICY "Users can create responses for own submissions"
ON public.responses FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.submissions s
    WHERE s.id = submission_id
    AND (s.user_id = auth.uid() OR s.user_id IS NULL)
  )
);

CREATE POLICY "Users can delete responses of own submissions"
ON public.responses FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.submissions s
    WHERE s.id = responses.submission_id
    AND s.user_id = auth.uid()
  )
);