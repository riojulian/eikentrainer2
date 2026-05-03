
ALTER TABLE public.chunk_attempts RENAME TO mission_attempts;
ALTER TABLE public.mission_attempts RENAME COLUMN chunk_index TO mission_index;
ALTER INDEX idx_chunk_attempts_student_taken RENAME TO idx_mission_attempts_student_taken;

ALTER TABLE public.study_progress RENAME COLUMN current_chunk TO current_mission;
ALTER TABLE public.study_progress RENAME COLUMN chunk_size TO mission_size;
