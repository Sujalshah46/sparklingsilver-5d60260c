
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS delivery_address text,
  ADD COLUMN IF NOT EXISTS additional_remarks text,
  ADD COLUMN IF NOT EXISTS profile_completed boolean NOT NULL DEFAULT false;
