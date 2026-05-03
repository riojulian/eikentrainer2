
-- student_word_order: per-student stable ordering of words
CREATE TABLE public.student_word_order (
  student_id uuid NOT NULL,
  word_id uuid NOT NULL,
  position integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (student_id, word_id)
);
CREATE INDEX idx_swo_student_position ON public.student_word_order(student_id, position);

ALTER TABLE public.student_word_order ENABLE ROW LEVEL SECURITY;

CREATE POLICY swo_select_own ON public.student_word_order
  FOR SELECT TO authenticated USING (student_id = auth.uid());
CREATE POLICY swo_insert_own ON public.student_word_order
  FOR INSERT TO authenticated WITH CHECK (student_id = auth.uid());
CREATE POLICY swo_delete_own ON public.student_word_order
  FOR DELETE TO authenticated USING (student_id = auth.uid());

-- study_progress
CREATE TABLE public.study_progress (
  student_id uuid PRIMARY KEY,
  current_chunk integer NOT NULL DEFAULT 1,
  chunk_size integer NOT NULL DEFAULT 10,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.study_progress ENABLE ROW LEVEL SECURITY;

CREATE POLICY sp_select_own ON public.study_progress
  FOR SELECT TO authenticated USING (student_id = auth.uid());
CREATE POLICY sp_insert_own ON public.study_progress
  FOR INSERT TO authenticated WITH CHECK (student_id = auth.uid());
CREATE POLICY sp_update_own ON public.study_progress
  FOR UPDATE TO authenticated USING (student_id = auth.uid()) WITH CHECK (student_id = auth.uid());

-- chunk_attempts
CREATE TABLE public.chunk_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL,
  chunk_index integer,
  kind text NOT NULL,
  score integer NOT NULL,
  total integer NOT NULL,
  taken_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_chunk_attempts_student_taken ON public.chunk_attempts(student_id, taken_at DESC);

ALTER TABLE public.chunk_attempts ENABLE ROW LEVEL SECURITY;

CREATE POLICY ca_select_own ON public.chunk_attempts
  FOR SELECT TO authenticated USING (student_id = auth.uid());
CREATE POLICY ca_insert_own ON public.chunk_attempts
  FOR INSERT TO authenticated WITH CHECK (student_id = auth.uid());

-- Validate kind values via trigger
CREATE OR REPLACE FUNCTION public.validate_chunk_attempt_kind()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.kind NOT IN ('chunk','weekly','monthly') THEN
    RAISE EXCEPTION 'kind must be chunk, weekly, or monthly (got %)', NEW.kind;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_validate_chunk_attempt_kind
BEFORE INSERT OR UPDATE ON public.chunk_attempts
FOR EACH ROW EXECUTE FUNCTION public.validate_chunk_attempt_kind();
