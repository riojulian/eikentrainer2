
-- Roles
CREATE TYPE public.app_role AS ENUM ('admin', 'student');

CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL,
  UNIQUE(user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

-- Auto-create profile + default student role on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1)));
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'student');
  RETURN NEW;
END;
$$;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Images
CREATE TABLE public.images (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  storage_path TEXT NOT NULL,
  label TEXT,
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  processed BOOLEAN NOT NULL DEFAULT false,
  uploaded_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);
ALTER TABLE public.images ENABLE ROW LEVEL SECURITY;

-- Words
CREATE TABLE public.words (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  word TEXT NOT NULL,
  part_of_speech TEXT,
  definition TEXT NOT NULL,
  definition_ja TEXT,
  example_sentence TEXT,
  category TEXT,
  source_image_id UUID REFERENCES public.images(id) ON DELETE SET NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.words ENABLE ROW LEVEL SECURITY;
CREATE INDEX words_active_idx ON public.words(is_active);
CREATE INDEX words_category_idx ON public.words(category);

-- Word status (per student)
CREATE TABLE public.word_status (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  word_id UUID NOT NULL REFERENCES public.words(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status TEXT CHECK (status IN ('known','review')),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(word_id, student_id)
);
ALTER TABLE public.word_status ENABLE ROW LEVEL SECURITY;

-- Quiz results
CREATE TABLE public.quiz_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  word_id UUID NOT NULL REFERENCES public.words(id) ON DELETE CASCADE,
  correct BOOLEAN NOT NULL,
  taken_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.quiz_results ENABLE ROW LEVEL SECURITY;
CREATE INDEX quiz_results_student_idx ON public.quiz_results(student_id);

-- ===== RLS POLICIES =====

-- profiles: users see own, admins see all
CREATE POLICY "profiles_select_own" ON public.profiles FOR SELECT TO authenticated USING (id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "profiles_update_own" ON public.profiles FOR UPDATE TO authenticated USING (id = auth.uid());

-- user_roles: users see own, admins manage
CREATE POLICY "roles_select_own" ON public.user_roles FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "roles_admin_all" ON public.user_roles FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- words: any authenticated user can read; only admins write
CREATE POLICY "words_select_auth" ON public.words FOR SELECT TO authenticated USING (true);
CREATE POLICY "words_admin_write" ON public.words FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- images: admins only
CREATE POLICY "images_admin_all" ON public.images FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- word_status: students manage own; admins read all
CREATE POLICY "ws_select_own_or_admin" ON public.word_status FOR SELECT TO authenticated USING (student_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "ws_insert_own" ON public.word_status FOR INSERT TO authenticated WITH CHECK (student_id = auth.uid());
CREATE POLICY "ws_update_own" ON public.word_status FOR UPDATE TO authenticated USING (student_id = auth.uid()) WITH CHECK (student_id = auth.uid());
CREATE POLICY "ws_delete_own" ON public.word_status FOR DELETE TO authenticated USING (student_id = auth.uid());

-- quiz_results: students insert own, read own; admins read all
CREATE POLICY "qr_select_own_or_admin" ON public.quiz_results FOR SELECT TO authenticated USING (student_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "qr_insert_own" ON public.quiz_results FOR INSERT TO authenticated WITH CHECK (student_id = auth.uid());

-- Storage bucket for exam images
INSERT INTO storage.buckets (id, name, public) VALUES ('exam-images', 'exam-images', false);

CREATE POLICY "exam_images_admin_select" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'exam-images' AND public.has_role(auth.uid(), 'admin'));
CREATE POLICY "exam_images_admin_insert" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'exam-images' AND public.has_role(auth.uid(), 'admin'));
CREATE POLICY "exam_images_admin_delete" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'exam-images' AND public.has_role(auth.uid(), 'admin'));

-- Seed sample words
INSERT INTO public.words (word, part_of_speech, definition, definition_ja, example_sentence, category) VALUES
('humidity', 'noun', 'The amount of moisture (water vapor) in the air.', '空気中の水分の量。湿気。', 'The tropical city had high <strong>humidity</strong>, making it feel hotter.', 'Weather & Nature'),
('indispensable', 'adj', 'Absolutely necessary; cannot do without it.', '絶対に必要な。なくてはならない。', 'A reliable internet connection has become <strong>indispensable</strong> for business.', 'Key Adjectives'),
('entrepreneur', 'noun', 'A person who starts and runs their own business.', '自分で会社や事業を始める人。起業家。', 'As a young <strong>entrepreneur</strong>, she launched her first startup at 22.', 'Business & Career'),
('bargain', 'noun', 'Something bought for less than its usual price; a good deal.', 'お買い得な品。安い買い物。', 'She managed to strike a great <strong>bargain</strong> at the market.', 'Shopping & Commerce'),
('hypothetical', 'adj', 'Imagined as an example, not real.', '仮の。もしもの場合の。', 'Let''s consider a <strong>hypothetical</strong> scenario: what if you lost all your data?', 'Academic & Analytical');
