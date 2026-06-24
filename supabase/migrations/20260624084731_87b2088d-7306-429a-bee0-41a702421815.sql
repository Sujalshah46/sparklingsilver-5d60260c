
-- 1) Move has_role out of public schema to prevent execution via PostgREST
CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM PUBLIC;
GRANT USAGE ON SCHEMA private TO authenticated, service_role;

-- Drop dependent policy first
DROP POLICY IF EXISTS "admins view enquiries" ON public.enquiries;

-- Recreate function in private schema
DROP FUNCTION IF EXISTS public.has_role(uuid, public.app_role);

CREATE OR REPLACE FUNCTION private.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

REVOKE ALL ON FUNCTION private.has_role(uuid, public.app_role) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.has_role(uuid, public.app_role) TO authenticated, service_role;

-- Recreate dependent policy using the private function
CREATE POLICY "admins view enquiries" ON public.enquiries
  FOR SELECT TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::public.app_role));

-- 2) Rate-limit enquiries: max 3 per hour per phone/email/name
CREATE OR REPLACE FUNCTION public.enforce_enquiry_rate_limit()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  recent_count int;
BEGIN
  SELECT count(*) INTO recent_count
  FROM public.enquiries
  WHERE created_at > now() - interval '1 hour'
    AND (
      phone = NEW.phone
      OR (NEW.email IS NOT NULL AND email = NEW.email)
    );

  IF recent_count >= 3 THEN
    RAISE EXCEPTION 'Too many enquiries from this contact. Please try again later.'
      USING ERRCODE = '429';
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.enforce_enquiry_rate_limit() FROM PUBLIC;

DROP TRIGGER IF EXISTS enquiries_rate_limit ON public.enquiries;
CREATE TRIGGER enquiries_rate_limit
  BEFORE INSERT ON public.enquiries
  FOR EACH ROW EXECUTE FUNCTION public.enforce_enquiry_rate_limit();

-- 3) Lock down user_roles: explicit policies blocking client-side writes.
-- RLS without policies already denies, but we add explicit restrictive
-- policies + revoke INSERT/UPDATE/DELETE grants so attempts fail at the
-- privilege layer too. Only service_role can manage roles.

REVOKE INSERT, UPDATE, DELETE ON public.user_roles FROM authenticated, anon;
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;

-- Explicit restrictive policy to make intent crystal clear and block any
-- future broad permissive policy from accidentally enabling writes.
DROP POLICY IF EXISTS "no client writes to user_roles" ON public.user_roles;
CREATE POLICY "no client writes to user_roles"
  ON public.user_roles
  AS RESTRICTIVE
  FOR ALL
  TO authenticated, anon
  USING (false)
  WITH CHECK (false);

-- Re-add the existing select policy scope (the restrictive policy above
-- applies to ALL, but FOR SELECT is unaffected because RESTRICTIVE policies
-- combine via AND only with permissive policies of the same command; we want
-- SELECT to still work, so make the restrictive policy not apply to SELECT).
DROP POLICY IF EXISTS "no client writes to user_roles" ON public.user_roles;
CREATE POLICY "no client insert user_roles" ON public.user_roles
  AS RESTRICTIVE FOR INSERT TO authenticated, anon WITH CHECK (false);
CREATE POLICY "no client update user_roles" ON public.user_roles
  AS RESTRICTIVE FOR UPDATE TO authenticated, anon USING (false) WITH CHECK (false);
CREATE POLICY "no client delete user_roles" ON public.user_roles
  AS RESTRICTIVE FOR DELETE TO authenticated, anon USING (false);
