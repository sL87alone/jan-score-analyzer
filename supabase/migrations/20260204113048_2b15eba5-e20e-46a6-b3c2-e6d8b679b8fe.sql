-- Fix RLS for answer_keys: Allow public SELECT (needed for analysis)
-- Keep admin-only INSERT/UPDATE/DELETE via edge function (service role)

-- First, drop the restrictive admin-only policy
DROP POLICY IF EXISTS "Admins can manage answer keys" ON public.answer_keys;

-- Allow anyone to SELECT answer keys (needed for student analysis)
CREATE POLICY "Anyone can view answer keys"
ON public.answer_keys
FOR SELECT
USING (true);

-- Admin writes happen through edge functions with service role key
-- No INSERT/UPDATE/DELETE policies needed for regular users

-- Ensure RLS is enabled
ALTER TABLE public.answer_keys ENABLE ROW LEVEL SECURITY;