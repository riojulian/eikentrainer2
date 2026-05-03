
-- Rename mission_attempts → stage_attempts
ALTER TABLE public.mission_attempts RENAME TO stage_attempts;
ALTER TABLE public.stage_attempts RENAME COLUMN mission_index TO stage_index;

-- Rename study_progress columns
ALTER TABLE public.study_progress RENAME COLUMN current_mission TO current_stage;
ALTER TABLE public.study_progress RENAME COLUMN mission_size TO stage_size;

-- student_stats
CREATE TABLE public.student_stats (
  student_id UUID NOT NULL PRIMARY KEY,
  xp INTEGER NOT NULL DEFAULT 0,
  current_streak INTEGER NOT NULL DEFAULT 0,
  longest_streak INTEGER NOT NULL DEFAULT 0,
  last_active_date DATE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.student_stats ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ss_select_own" ON public.student_stats FOR SELECT TO authenticated USING (student_id = auth.uid());
CREATE POLICY "ss_insert_own" ON public.student_stats FOR INSERT TO authenticated WITH CHECK (student_id = auth.uid());
CREATE POLICY "ss_update_own" ON public.student_stats FOR UPDATE TO authenticated USING (student_id = auth.uid()) WITH CHECK (student_id = auth.uid());

-- student_badges
CREATE TABLE public.student_badges (
  id UUID NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL,
  badge_key TEXT NOT NULL,
  earned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (student_id, badge_key)
);
ALTER TABLE public.student_badges ENABLE ROW LEVEL SECURITY;

CREATE POLICY "sb_select_own" ON public.student_badges FOR SELECT TO authenticated USING (student_id = auth.uid());
CREATE POLICY "sb_insert_own" ON public.student_badges FOR INSERT TO authenticated WITH CHECK (student_id = auth.uid());

CREATE INDEX idx_student_badges_student ON public.student_badges(student_id);
