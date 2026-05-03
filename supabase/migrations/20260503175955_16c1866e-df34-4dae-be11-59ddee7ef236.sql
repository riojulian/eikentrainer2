
ALTER TABLE public.study_progress ADD COLUMN IF NOT EXISTS current_world text DEFAULT 'tier1';

ALTER TABLE public.student_word_order ADD COLUMN IF NOT EXISTS world text;
CREATE INDEX IF NOT EXISTS student_word_order_student_world_idx ON public.student_word_order(student_id, world, position);

ALTER TABLE public.stage_attempts ADD COLUMN IF NOT EXISTS world text;

CREATE TABLE IF NOT EXISTS public.world_progress (
  student_id uuid NOT NULL,
  world text NOT NULL,
  current_stage integer NOT NULL DEFAULT 1,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (student_id, world)
);

ALTER TABLE public.world_progress ENABLE ROW LEVEL SECURITY;

CREATE POLICY wp_select_own ON public.world_progress
  FOR SELECT TO authenticated USING (student_id = auth.uid());

CREATE POLICY wp_insert_own ON public.world_progress
  FOR INSERT TO authenticated WITH CHECK (student_id = auth.uid());

CREATE POLICY wp_update_own ON public.world_progress
  FOR UPDATE TO authenticated USING (student_id = auth.uid()) WITH CHECK (student_id = auth.uid());
