CREATE TABLE IF NOT EXISTS public.expo_push_tokens (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  token text NOT NULL UNIQUE,
  platform text,
  device_name text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_expo_push_tokens_user ON public.expo_push_tokens(user_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.expo_push_tokens TO authenticated;
GRANT ALL ON public.expo_push_tokens TO service_role;

ALTER TABLE public.expo_push_tokens ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage their own device tokens" ON public.expo_push_tokens;
CREATE POLICY "Users manage their own device tokens"
ON public.expo_push_tokens FOR ALL TO authenticated
USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);