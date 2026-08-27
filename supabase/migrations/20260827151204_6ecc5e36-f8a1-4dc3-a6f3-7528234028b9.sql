REVOKE ALL ON FUNCTION public.is_approved_user(uuid) FROM anon;
REVOKE ALL ON FUNCTION public.is_approved_user(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_approved_user(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_approved_user(uuid) TO service_role;