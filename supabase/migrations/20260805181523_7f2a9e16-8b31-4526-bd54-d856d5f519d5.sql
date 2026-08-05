-- ============ CONTENT TABLES ============
CREATE TABLE public.exams (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  description text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.exams TO anon, authenticated;
GRANT ALL ON public.exams TO service_role;
ALTER TABLE public.exams ENABLE ROW LEVEL SECURITY;
CREATE POLICY exams_read ON public.exams FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY exams_admin ON public.exams FOR ALL TO authenticated USING (has_role(auth.uid(),'admin')) WITH CHECK (has_role(auth.uid(),'admin'));

CREATE TABLE public.exam_sections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  exam_id uuid NOT NULL REFERENCES public.exams(id) ON DELETE CASCADE,
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  module_type text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.exam_sections TO anon, authenticated;
GRANT ALL ON public.exam_sections TO service_role;
ALTER TABLE public.exam_sections ENABLE ROW LEVEL SECURITY;
CREATE POLICY exam_sections_read ON public.exam_sections FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY exam_sections_admin ON public.exam_sections FOR ALL TO authenticated USING (has_role(auth.uid(),'admin')) WITH CHECK (has_role(auth.uid(),'admin'));

CREATE OR REPLACE FUNCTION public.validate_module_type()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.module_type NOT IN ('vocab','logical_flow','detail_inference') THEN
    RAISE EXCEPTION 'module_type must be vocab, logical_flow or detail_inference (got %)', NEW.module_type;
  END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER trg_exam_sections_module_type BEFORE INSERT OR UPDATE ON public.exam_sections
FOR EACH ROW EXECUTE FUNCTION public.validate_module_type();

CREATE TABLE public.subskills (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  exam_section_id uuid NOT NULL REFERENCES public.exam_sections(id) ON DELETE CASCADE,
  key text NOT NULL,
  label_en text NOT NULL,
  label_ja text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (exam_section_id, key)
);
GRANT SELECT ON public.subskills TO anon, authenticated;
GRANT ALL ON public.subskills TO service_role;
ALTER TABLE public.subskills ENABLE ROW LEVEL SECURITY;
CREATE POLICY subskills_read ON public.subskills FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY subskills_admin ON public.subskills FOR ALL TO authenticated USING (has_role(auth.uid(),'admin')) WITH CHECK (has_role(auth.uid(),'admin'));

CREATE TABLE public.passages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  exam_section_id uuid NOT NULL REFERENCES public.exam_sections(id) ON DELETE CASCADE,
  seed_key text UNIQUE,
  title text NOT NULL,
  body_text text NOT NULL,
  topic_tag text,
  word_count integer,
  difficulty_rating integer NOT NULL DEFAULT 3,
  source text NOT NULL DEFAULT 'seed',
  status text NOT NULL DEFAULT 'review',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.passages TO anon, authenticated;
GRANT ALL ON public.passages TO service_role;
ALTER TABLE public.passages ENABLE ROW LEVEL SECURITY;
CREATE POLICY passages_read_active ON public.passages FOR SELECT TO anon, authenticated USING (status = 'active');
CREATE POLICY passages_admin ON public.passages FOR ALL TO authenticated USING (has_role(auth.uid(),'admin')) WITH CHECK (has_role(auth.uid(),'admin'));

CREATE TABLE public.passage_sentences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  passage_id uuid NOT NULL REFERENCES public.passages(id) ON DELETE CASCADE,
  sentence_index integer NOT NULL,
  label text,
  text text NOT NULL,
  UNIQUE (passage_id, sentence_index)
);
GRANT SELECT ON public.passage_sentences TO anon, authenticated;
GRANT ALL ON public.passage_sentences TO service_role;
ALTER TABLE public.passage_sentences ENABLE ROW LEVEL SECURITY;
CREATE POLICY passage_sentences_read ON public.passage_sentences FOR SELECT TO anon, authenticated
  USING (EXISTS (SELECT 1 FROM public.passages p WHERE p.id = passage_id AND p.status = 'active'));
CREATE POLICY passage_sentences_admin ON public.passage_sentences FOR ALL TO authenticated USING (has_role(auth.uid(),'admin')) WITH CHECK (has_role(auth.uid(),'admin'));

CREATE TABLE public.questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  exam_section_id uuid NOT NULL REFERENCES public.exam_sections(id) ON DELETE CASCADE,
  passage_id uuid REFERENCES public.passages(id) ON DELETE CASCADE,
  seed_key text UNIQUE,
  prompt text NOT NULL,
  blank_number integer,
  choices jsonb NOT NULL,
  correct_choice_index integer NOT NULL,
  explanation text,
  subskill_ids uuid[] NOT NULL DEFAULT '{}',
  evidence_sentence_ids uuid[],
  difficulty_rating integer NOT NULL DEFAULT 3,
  source text NOT NULL DEFAULT 'seed',
  status text NOT NULL DEFAULT 'review',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX questions_section_status_idx ON public.questions (exam_section_id, status);
CREATE INDEX questions_subskill_idx ON public.questions USING gin (subskill_ids);
GRANT SELECT ON public.questions TO anon, authenticated;
GRANT ALL ON public.questions TO service_role;
ALTER TABLE public.questions ENABLE ROW LEVEL SECURITY;
CREATE POLICY questions_read_active ON public.questions FOR SELECT TO anon, authenticated USING (status = 'active');
CREATE POLICY questions_admin ON public.questions FOR ALL TO authenticated USING (has_role(auth.uid(),'admin')) WITH CHECK (has_role(auth.uid(),'admin'));

-- ============ USER TABLES ============
CREATE TABLE public.user_subskill_stats (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  subskill_id uuid NOT NULL REFERENCES public.subskills(id) ON DELETE CASCADE,
  attempts integer NOT NULL DEFAULT 0,
  correct integer NOT NULL DEFAULT 0,
  rolling_accuracy numeric NOT NULL DEFAULT 0,
  last_practiced_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, subskill_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_subskill_stats TO authenticated;
GRANT ALL ON public.user_subskill_stats TO service_role;
ALTER TABLE public.user_subskill_stats ENABLE ROW LEVEL SECURITY;
CREATE POLICY uss_select ON public.user_subskill_stats FOR SELECT TO authenticated USING (user_id = auth.uid() OR has_role(auth.uid(),'admin'));
CREATE POLICY uss_insert ON public.user_subskill_stats FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY uss_update ON public.user_subskill_stats FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE TABLE public.user_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  module_type text NOT NULL,
  started_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz,
  questions_served uuid[] NOT NULL DEFAULT '{}'
);
GRANT SELECT, INSERT, UPDATE ON public.user_sessions TO authenticated;
GRANT ALL ON public.user_sessions TO service_role;
ALTER TABLE public.user_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY us_select ON public.user_sessions FOR SELECT TO authenticated USING (user_id = auth.uid() OR has_role(auth.uid(),'admin'));
CREATE POLICY us_insert ON public.user_sessions FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY us_update ON public.user_sessions FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE TABLE public.user_answers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_session_id uuid REFERENCES public.user_sessions(id) ON DELETE SET NULL,
  question_id uuid NOT NULL REFERENCES public.questions(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  selected_choice_index integer NOT NULL,
  is_correct boolean NOT NULL,
  tapped_sentence_id uuid REFERENCES public.passage_sentences(id) ON DELETE SET NULL,
  evidence_outcome text,
  answered_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX user_answers_user_idx ON public.user_answers (user_id, answered_at DESC);
GRANT SELECT, INSERT ON public.user_answers TO authenticated;
GRANT ALL ON public.user_answers TO service_role;
ALTER TABLE public.user_answers ENABLE ROW LEVEL SECURITY;
CREATE POLICY ua_select ON public.user_answers FOR SELECT TO authenticated USING (user_id = auth.uid() OR has_role(auth.uid(),'admin'));
CREATE POLICY ua_insert ON public.user_answers FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.validate_evidence_outcome()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.evidence_outcome IS NOT NULL AND NEW.evidence_outcome NOT IN ('correct_evidence','lucky_guess','reasonable_miss','no_evidence_found') THEN
    RAISE EXCEPTION 'invalid evidence_outcome %', NEW.evidence_outcome;
  END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER trg_user_answers_evidence BEFORE INSERT OR UPDATE ON public.user_answers
FOR EACH ROW EXECUTE FUNCTION public.validate_evidence_outcome();

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END; $$;

CREATE TRIGGER trg_passages_updated_at BEFORE UPDATE ON public.passages
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_questions_updated_at BEFORE UPDATE ON public.questions
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();