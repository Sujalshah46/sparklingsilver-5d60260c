-- ============================================
-- SPARKLING SILVER: PERSISTENT RATE LIMITING
-- ============================================
-- Creates a table to persist API request attempts for rate limiting

CREATE TABLE IF NOT EXISTS public.rate_limit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  identifier TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS (Row Level Security) on the log table
ALTER TABLE public.rate_limit_log ENABLE ROW LEVEL SECURITY;

-- Allow service_role and authenticated/anonymous users to insert attempts, but only service_role can read/query all
CREATE POLICY "Allow service_role full access to rate_limit_log" 
  ON public.rate_limit_log 
  FOR ALL 
  TO service_role 
  USING (true);

-- Index for rapid rate limit lookup
CREATE INDEX IF NOT EXISTS rate_limit_log_identifier_created_at_idx 
  ON public.rate_limit_log(identifier, created_at);
