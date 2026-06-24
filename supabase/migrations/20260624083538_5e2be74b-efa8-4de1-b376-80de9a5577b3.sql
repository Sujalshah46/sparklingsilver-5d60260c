
DROP POLICY IF EXISTS "anyone can create enquiry" ON public.enquiries;
CREATE POLICY "anyone can create enquiry" ON public.enquiries FOR INSERT TO anon, authenticated
  WITH CHECK (length(name) > 0 AND length(phone) > 0 AND length(message) > 0);
