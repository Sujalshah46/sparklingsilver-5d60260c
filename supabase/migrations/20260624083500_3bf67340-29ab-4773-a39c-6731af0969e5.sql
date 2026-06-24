
-- Restrict EXECUTE on SECURITY DEFINER functions so they cannot be called over the Data API
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.touch_updated_at() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.has_role(UUID, public.app_role) FROM PUBLIC, anon;
-- has_role still needs to be callable by authenticated for RLS policy use
GRANT EXECUTE ON FUNCTION public.has_role(UUID, public.app_role) TO authenticated;
