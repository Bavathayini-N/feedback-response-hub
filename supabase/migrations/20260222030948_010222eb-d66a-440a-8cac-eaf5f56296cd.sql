
-- 1. Create app_role enum
CREATE TYPE public.app_role AS ENUM ('admin', 'trainee');

-- 2. User roles table
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  UNIQUE (user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- 3. Profiles table
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  full_name TEXT NOT NULL DEFAULT '',
  email TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- 4. Feedback table
CREATE TABLE public.feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trainee_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.feedback ENABLE ROW LEVEL SECURITY;

-- 5. Admin responses table
CREATE TABLE public.admin_responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  feedback_id UUID REFERENCES public.feedback(id) ON DELETE CASCADE NOT NULL UNIQUE,
  admin_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  response_text TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'replied' CHECK (status IN ('replied', 'acknowledged')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.admin_responses ENABLE ROW LEVEL SECURITY;

-- 6. Security definer function: has_role
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- 7. Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, full_name, email)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', ''), NEW.email);
  
  -- Default role is trainee
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, COALESCE((NEW.raw_user_meta_data->>'role')::app_role, 'trainee'));
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 8. Updated_at trigger
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_feedback_updated_at BEFORE UPDATE ON public.feedback FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_admin_responses_updated_at BEFORE UPDATE ON public.admin_responses FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 9. RLS Policies

-- user_roles: users can read their own role
CREATE POLICY "Users can read own role" ON public.user_roles FOR SELECT USING (auth.uid() = user_id);
-- admins can read all roles
CREATE POLICY "Admins can read all roles" ON public.user_roles FOR SELECT USING (public.has_role(auth.uid(), 'admin'));

-- profiles: users can read/update own profile
CREATE POLICY "Users can read own profile" ON public.profiles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = user_id);
-- admins can read all profiles
CREATE POLICY "Admins can read all profiles" ON public.profiles FOR SELECT USING (public.has_role(auth.uid(), 'admin'));

-- feedback: trainees can insert own feedback
CREATE POLICY "Trainees can insert feedback" ON public.feedback FOR INSERT WITH CHECK (auth.uid() = trainee_id AND public.has_role(auth.uid(), 'trainee'));
-- trainees can read own feedback
CREATE POLICY "Trainees can read own feedback" ON public.feedback FOR SELECT USING (auth.uid() = trainee_id);
-- admins can read all feedback
CREATE POLICY "Admins can read all feedback" ON public.feedback FOR SELECT USING (public.has_role(auth.uid(), 'admin'));

-- admin_responses: admins can insert
CREATE POLICY "Admins can insert responses" ON public.admin_responses FOR INSERT WITH CHECK (public.has_role(auth.uid(), 'admin') AND auth.uid() = admin_id);
-- admins can read all responses
CREATE POLICY "Admins can read all responses" ON public.admin_responses FOR SELECT USING (public.has_role(auth.uid(), 'admin'));
-- admins can update own responses
CREATE POLICY "Admins can update own responses" ON public.admin_responses FOR UPDATE USING (public.has_role(auth.uid(), 'admin') AND auth.uid() = admin_id);
-- admins can delete own responses
CREATE POLICY "Admins can delete own responses" ON public.admin_responses FOR DELETE USING (public.has_role(auth.uid(), 'admin') AND auth.uid() = admin_id);
-- trainees can read responses to their feedback
CREATE POLICY "Trainees can read responses to own feedback" ON public.admin_responses FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.feedback WHERE feedback.id = admin_responses.feedback_id AND feedback.trainee_id = auth.uid())
);
-- trainees can update status to acknowledged
CREATE POLICY "Trainees can acknowledge responses" ON public.admin_responses FOR UPDATE USING (
  EXISTS (SELECT 1 FROM public.feedback WHERE feedback.id = admin_responses.feedback_id AND feedback.trainee_id = auth.uid())
) WITH CHECK (
  status = 'acknowledged'
);
