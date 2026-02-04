-- Add UPDATE policy for submissions table so users can update the scores after inserting
-- This is needed because the flow is: INSERT submission -> calculate scores -> UPDATE submission

CREATE POLICY "Anyone can update submissions" 
ON public.submissions 
FOR UPDATE 
USING (true)
WITH CHECK (true);
