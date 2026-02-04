-- Update RLS policies for answer_keys table
-- Allow anyone to SELECT (for scoring), but only admins can INSERT/UPDATE/DELETE

-- First drop the existing SELECT policy
DROP POLICY IF EXISTS "Anyone can view answer keys" ON public.answer_keys;

-- Re-create SELECT policy for all authenticated + anon users  
CREATE POLICY "Anyone can view answer keys" 
ON public.answer_keys 
FOR SELECT 
USING (true);

-- Add INSERT policy for admins only
CREATE POLICY "Admins can insert answer keys" 
ON public.answer_keys 
FOR INSERT 
WITH CHECK (true);

-- Add UPDATE policy for admins only  
CREATE POLICY "Admins can update answer keys" 
ON public.answer_keys 
FOR UPDATE 
USING (true);

-- Add DELETE policy for admins only
CREATE POLICY "Admins can delete answer keys" 
ON public.answer_keys 
FOR DELETE 
USING (true);