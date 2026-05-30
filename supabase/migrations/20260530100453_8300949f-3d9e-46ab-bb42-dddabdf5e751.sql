
-- 1. student_word_order: add UPDATE policy
CREATE POLICY "swo_update_own" ON public.student_word_order
FOR UPDATE TO authenticated
USING (student_id = auth.uid())
WITH CHECK (student_id = auth.uid());

-- 2. page_views: add INSERT policy (user_id must match auth.uid() or be null for anon-like tracking)
CREATE POLICY "page_views_insert_self" ON public.page_views
FOR INSERT TO authenticated
WITH CHECK (user_id IS NULL OR user_id = auth.uid());

-- 3. user_roles: restrictive policy blocking non-admin role assignment
CREATE POLICY "roles_block_non_admin_insert" ON public.user_roles
AS RESTRICTIVE
FOR INSERT TO authenticated
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "roles_block_non_admin_update" ON public.user_roles
AS RESTRICTIVE
FOR UPDATE TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "roles_block_non_admin_delete" ON public.user_roles
AS RESTRICTIVE
FOR DELETE TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- 4. Revoke EXECUTE on has_role from anon (only authenticated paths need it for RLS)
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM anon, PUBLIC;
