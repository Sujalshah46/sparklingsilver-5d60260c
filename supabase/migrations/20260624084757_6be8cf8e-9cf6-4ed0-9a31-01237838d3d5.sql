
DROP TRIGGER IF EXISTS enquiries_rate_limit ON public.enquiries;
DROP FUNCTION IF EXISTS public.enforce_enquiry_rate_limit();

CREATE OR REPLACE FUNCTION private.enforce_enquiry_rate_limit()
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

REVOKE ALL ON FUNCTION private.enforce_enquiry_rate_limit() FROM PUBLIC;

CREATE TRIGGER enquiries_rate_limit
  BEFORE INSERT ON public.enquiries
  FOR EACH ROW EXECUTE FUNCTION private.enforce_enquiry_rate_limit();
