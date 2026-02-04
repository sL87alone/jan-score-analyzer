-- Create app_role enum for admin functionality
CREATE TYPE public.app_role AS ENUM ('admin', 'user');

-- Create user_roles table for role management
CREATE TABLE public.user_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    role app_role NOT NULL DEFAULT 'user',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE (user_id, role)
);

-- Create tests table
CREATE TABLE public.tests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    shift TEXT NOT NULL,
    exam_date DATE,
    marking_rules_json JSONB NOT NULL DEFAULT '{
        "mcq_single": {"correct": 4, "wrong": -1, "unattempted": 0},
        "msq": {"correct": 4, "wrong": -2, "unattempted": 0},
        "numerical": {"correct": 4, "wrong": -1, "unattempted": 0}
    }'::jsonb,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create answer_keys table
CREATE TABLE public.answer_keys (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    test_id UUID REFERENCES public.tests(id) ON DELETE CASCADE NOT NULL,
    question_id TEXT NOT NULL,
    subject TEXT NOT NULL CHECK (subject IN ('Mathematics', 'Physics', 'Chemistry')),
    question_type TEXT NOT NULL CHECK (question_type IN ('mcq_single', 'msq', 'numerical')),
    correct_option_ids TEXT[] DEFAULT NULL,
    correct_numeric_value DECIMAL DEFAULT NULL,
    numeric_tolerance DECIMAL DEFAULT 0,
    is_cancelled BOOLEAN NOT NULL DEFAULT false,
    is_bonus BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE (test_id, question_id)
);

-- Create submissions table
CREATE TABLE public.submissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    test_id UUID REFERENCES public.tests(id) ON DELETE SET NULL,
    source_type TEXT NOT NULL CHECK (source_type IN ('url', 'html')),
    share_enabled BOOLEAN NOT NULL DEFAULT true,
    total_marks DECIMAL DEFAULT 0,
    total_attempted INTEGER DEFAULT 0,
    total_correct INTEGER DEFAULT 0,
    total_wrong INTEGER DEFAULT 0,
    total_unattempted INTEGER DEFAULT 0,
    accuracy_percentage DECIMAL DEFAULT 0,
    negative_marks DECIMAL DEFAULT 0,
    math_marks DECIMAL DEFAULT 0,
    physics_marks DECIMAL DEFAULT 0,
    chemistry_marks DECIMAL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create responses table
CREATE TABLE public.responses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    submission_id UUID REFERENCES public.submissions(id) ON DELETE CASCADE NOT NULL,
    question_id TEXT NOT NULL,
    claimed_option_ids TEXT[] DEFAULT NULL,
    claimed_numeric_value DECIMAL DEFAULT NULL,
    status TEXT NOT NULL CHECK (status IN ('correct', 'wrong', 'unattempted', 'cancelled')),
    marks_awarded DECIMAL NOT NULL DEFAULT 0,
    subject TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create index for faster lookups
CREATE INDEX idx_answer_keys_test_id ON public.answer_keys(test_id);
CREATE INDEX idx_responses_submission_id ON public.responses(submission_id);
CREATE INDEX idx_submissions_created_at ON public.submissions(created_at DESC);

-- Enable RLS
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.answer_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.responses ENABLE ROW LEVEL SECURITY;

-- Create security definer function to check admin role
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- Create helper function to check if user is admin
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.has_role(auth.uid(), 'admin')
$$;

-- RLS Policies for user_roles
CREATE POLICY "Users can view own roles"
ON public.user_roles FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage all roles"
ON public.user_roles FOR ALL
USING (public.is_admin());

-- RLS Policies for tests (public read, admin write)
CREATE POLICY "Anyone can view active tests"
ON public.tests FOR SELECT
USING (is_active = true);

CREATE POLICY "Admins can manage tests"
ON public.tests FOR ALL
USING (public.is_admin());

-- RLS Policies for answer_keys (admin only, needed for scoring in edge function)
CREATE POLICY "Admins can manage answer keys"
ON public.answer_keys FOR ALL
USING (public.is_admin());

-- RLS Policies for submissions (public can create and view by id)
CREATE POLICY "Anyone can create submissions"
ON public.submissions FOR INSERT
WITH CHECK (true);

CREATE POLICY "Anyone can view submissions"
ON public.submissions FOR SELECT
USING (share_enabled = true);

CREATE POLICY "Admins can manage all submissions"
ON public.submissions FOR ALL
USING (public.is_admin());

CREATE POLICY "Anyone can delete submissions"
ON public.submissions FOR DELETE
USING (true);

-- RLS Policies for responses
CREATE POLICY "Anyone can create responses"
ON public.responses FOR INSERT
WITH CHECK (true);

CREATE POLICY "Anyone can view responses of shared submissions"
ON public.responses FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.submissions s 
    WHERE s.id = submission_id 
    AND s.share_enabled = true
  )
);

CREATE POLICY "Anyone can delete responses"
ON public.responses FOR DELETE
USING (true);

CREATE POLICY "Admins can manage all responses"
ON public.responses FOR ALL
USING (public.is_admin());

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Trigger for tests updated_at
CREATE TRIGGER update_tests_updated_at
BEFORE UPDATE ON public.tests
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Function to get answer keys for scoring (security definer to bypass RLS)
CREATE OR REPLACE FUNCTION public.get_answer_keys_for_test(p_test_id UUID)
RETURNS TABLE (
    question_id TEXT,
    subject TEXT,
    question_type TEXT,
    correct_option_ids TEXT[],
    correct_numeric_value DECIMAL,
    numeric_tolerance DECIMAL,
    is_cancelled BOOLEAN,
    is_bonus BOOLEAN
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    ak.question_id,
    ak.subject,
    ak.question_type,
    ak.correct_option_ids,
    ak.correct_numeric_value,
    ak.numeric_tolerance,
    ak.is_cancelled,
    ak.is_bonus
  FROM public.answer_keys ak
  WHERE ak.test_id = p_test_id
$$;

-- Function to get test marking rules
CREATE OR REPLACE FUNCTION public.get_test_marking_rules(p_test_id UUID)
RETURNS JSONB
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT marking_rules_json
  FROM public.tests
  WHERE id = p_test_id
$$;