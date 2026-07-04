
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS username text UNIQUE,
  ADD COLUMN IF NOT EXISTS contact_person text,
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','inactive')),
  ADD COLUMN IF NOT EXISTS must_change_password boolean NOT NULL DEFAULT false;

DROP POLICY IF EXISTS "admins view all profiles" ON public.profiles;
CREATE POLICY "admins view all profiles" ON public.profiles
  FOR SELECT TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "admins update all profiles" ON public.profiles;
CREATE POLICY "admins update all profiles" ON public.profiles
  FOR UPDATE TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (private.has_role(auth.uid(), 'admin'::app_role));

CREATE TABLE IF NOT EXISTS public.password_reset_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  email text NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','resolved','rejected')),
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz,
  resolved_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.password_reset_requests TO authenticated;
GRANT INSERT ON public.password_reset_requests TO anon;
GRANT ALL ON public.password_reset_requests TO service_role;
ALTER TABLE public.password_reset_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anyone can submit reset request" ON public.password_reset_requests;
CREATE POLICY "anyone can submit reset request" ON public.password_reset_requests
  FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "admins view all reset requests" ON public.password_reset_requests;
CREATE POLICY "admins view all reset requests" ON public.password_reset_requests
  FOR SELECT TO authenticated USING (private.has_role(auth.uid(), 'admin'::app_role));
DROP POLICY IF EXISTS "admins update reset requests" ON public.password_reset_requests;
CREATE POLICY "admins update reset requests" ON public.password_reset_requests
  FOR UPDATE TO authenticated USING (private.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (private.has_role(auth.uid(), 'admin'::app_role));

CREATE TABLE IF NOT EXISTS public.user_activity_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  actor_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  action text NOT NULL,
  meta jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.user_activity_log TO authenticated;
GRANT ALL ON public.user_activity_log TO service_role;
ALTER TABLE public.user_activity_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admins view activity log" ON public.user_activity_log;
CREATE POLICY "admins view activity log" ON public.user_activity_log
  FOR SELECT TO authenticated USING (private.has_role(auth.uid(), 'admin'::app_role));
DROP POLICY IF EXISTS "users insert own activity" ON public.user_activity_log;
CREATE POLICY "users insert own activity" ON public.user_activity_log
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = actor_id OR auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, username, business_name, contact_person, mobile, must_change_password)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name'),
    NEW.raw_user_meta_data->>'username',
    NEW.raw_user_meta_data->>'business_name',
    NEW.raw_user_meta_data->>'contact_person',
    NEW.raw_user_meta_data->>'mobile',
    COALESCE((NEW.raw_user_meta_data->>'must_change_password')::boolean, false)
  )
  ON CONFLICT (id) DO NOTHING;
  IF lower(NEW.email) = 'sujalshah7102002@gmail.com' THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin')
    ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END $function$;
