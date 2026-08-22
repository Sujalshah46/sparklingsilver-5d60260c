CREATE TABLE public.trade_enquiries (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  business_name text NOT NULL,
  contact_person text NOT NULL,
  email text NOT NULL,
  phone text NOT NULL,
  city text NOT NULL,
  business_type text NOT NULL,
  message text,
  consent boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'new',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT INSERT ON public.trade_enquiries TO anon;
GRANT SELECT, INSERT, UPDATE ON public.trade_enquiries TO authenticated;
GRANT ALL ON public.trade_enquiries TO service_role;

ALTER TABLE public.trade_enquiries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can submit a trade enquiry"
  ON public.trade_enquiries FOR INSERT TO anon, authenticated
  WITH CHECK (consent = true);

CREATE POLICY "Admins can view trade enquiries"
  ON public.trade_enquiries FOR SELECT TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "Admins can update trade enquiries"
  ON public.trade_enquiries FOR UPDATE TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (private.has_role(auth.uid(), 'admin'::public.app_role));

CREATE INDEX idx_trade_enquiries_created_at ON public.trade_enquiries(created_at DESC);
CREATE INDEX idx_trade_enquiries_email ON public.trade_enquiries(email);

CREATE TRIGGER trade_enquiries_touch_updated_at
  BEFORE UPDATE ON public.trade_enquiries
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();