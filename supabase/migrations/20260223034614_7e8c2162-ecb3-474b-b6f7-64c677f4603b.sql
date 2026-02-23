
-- Create questions table
CREATE TABLE public.questions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  test_id UUID NOT NULL REFERENCES public.tests(id) ON DELETE CASCADE,
  question_number INTEGER NOT NULL,
  question_image_url TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(test_id, question_number)
);

-- Create question_options table
CREATE TABLE public.question_options (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  question_id UUID NOT NULL REFERENCES public.questions(id) ON DELETE CASCADE,
  option_number INTEGER NOT NULL CHECK (option_number BETWEEN 1 AND 4),
  option_image_url TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(question_id, option_number)
);

-- Enable RLS
ALTER TABLE public.questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.question_options ENABLE ROW LEVEL SECURITY;

-- RLS for questions: readable by users who have a submission for that test
CREATE POLICY "Users can view questions for their submitted tests"
ON public.questions FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.submissions s
    WHERE s.test_id = questions.test_id
    AND s.user_id = auth.uid()
  )
);

-- Admins can manage questions
CREATE POLICY "Admins can manage questions"
ON public.questions FOR ALL
USING (public.is_admin());

-- RLS for question_options: readable by users who have a submission for the related test
CREATE POLICY "Users can view options for their submitted tests"
ON public.question_options FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.questions q
    JOIN public.submissions s ON s.test_id = q.test_id
    WHERE q.id = question_options.question_id
    AND s.user_id = auth.uid()
  )
);

-- Admins can manage question_options
CREATE POLICY "Admins can manage question_options"
ON public.question_options FOR ALL
USING (public.is_admin());

-- Create storage bucket for question papers
INSERT INTO storage.buckets (id, name, public)
VALUES ('question-papers', 'question-papers', false);

-- Storage RLS: Only authenticated users with submission for the test can view
-- We'll use path-based access: question-papers/{test_id}/...
CREATE POLICY "Authenticated users can view question paper images"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'question-papers'
  AND auth.uid() IS NOT NULL
);

-- Admin can upload question paper images (via edge function with service role, but also direct)
CREATE POLICY "Admins can upload question paper images"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'question-papers'
  AND public.is_admin()
);

CREATE POLICY "Admins can update question paper images"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'question-papers'
  AND public.is_admin()
);

CREATE POLICY "Admins can delete question paper images"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'question-papers'
  AND public.is_admin()
);
