CREATE INDEX IF NOT EXISTS idx_word_status_student_updated
  ON public.word_status(student_id, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_stage_attempts_student_kind
  ON public.stage_attempts(student_id, kind);