GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated, anon, service_role;

DELETE FROM public.user_roles ur
WHERE ur.role = 'student'
  AND EXISTS (
    SELECT 1 FROM public.user_roles ur2
    WHERE ur2.user_id = ur.user_id AND ur2.role = 'admin'
  );
