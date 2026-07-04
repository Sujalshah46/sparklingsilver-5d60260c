
-- Tighten password_reset_requests INSERT policy: replace WITH CHECK (true) with
-- format validation and add a per-email rate limit trigger to prevent abuse.

DROP POLICY IF EXISTS "anyone can submit reset request" ON public.password_reset_requests;

CREATE POLICY "anyone can submit reset request"
ON public.password_reset_requests
FOR INSERT
TO anon, authenticated
WITH CHECK (
  status = 'pending'
  AND resolved_at IS NULL
  AND resolved_by IS NULL
  AND email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'
  AND length(email) <= 254
  AND (note IS NULL OR length(note) <= 500)
);

CREATE OR REPLACE FUNCTION public.rate_limit_password_reset_requests()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  recent_count int;
BEGIN
  SELECT count(*) INTO recent_count
  FROM public.password_reset_requests
  WHERE lower(email) = lower(NEW.email)
    AND created_at > now() - interval '1 hour';

  IF recent_count >= 3 THEN
    RAISE EXCEPTION 'Too many password reset requests for this email. Please try again later.'
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_rate_limit_password_reset_requests ON public.password_reset_requests;
CREATE TRIGGER trg_rate_limit_password_reset_requests
BEFORE INSERT ON public.password_reset_requests
FOR EACH ROW EXECUTE FUNCTION public.rate_limit_password_reset_requests();
