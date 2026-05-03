GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO service_role;

CREATE INDEX IF NOT EXISTS word_status_student_idx ON public.word_status(student_id);
CREATE INDEX IF NOT EXISTS quiz_results_word_idx ON public.quiz_results(word_id);
CREATE INDEX IF NOT EXISTS user_roles_user_id_idx ON public.user_roles(user_id);