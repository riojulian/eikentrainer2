
CREATE POLICY ss_select_admin ON public.student_stats FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY qr_select_admin ON public.quiz_results FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY sb_select_admin ON public.student_badges FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY ca_select_admin ON public.stage_attempts FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY sp_select_admin ON public.study_progress FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY wp_select_admin ON public.world_progress FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
