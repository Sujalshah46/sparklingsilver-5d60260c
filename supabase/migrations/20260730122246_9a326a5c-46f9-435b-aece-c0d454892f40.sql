CREATE TABLE public.admin_reset_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  email text NOT NULL,
  code_hash text NOT NULL,
  attempts int NOT NULL DEFAULT 0,
  used_at timestamptz,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX admin_reset_codes_email_idx ON public.admin_reset_codes (lower(email), created_at DESC);
GRANT ALL ON public.admin_reset_codes TO service_role;
ALTER TABLE public.admin_reset_codes ENABLE ROW LEVEL SECURITY;