ALTER TYPE public.order_status ADD VALUE IF NOT EXISTS 'confirmed';
ALTER TYPE public.order_status ADD VALUE IF NOT EXISTS 'out_for_delivery';
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS tracking_number TEXT;