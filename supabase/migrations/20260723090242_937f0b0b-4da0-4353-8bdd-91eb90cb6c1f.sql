ALTER TABLE public.cart_items ADD COLUMN IF NOT EXISTS remark text;
ALTER TABLE public.order_items ADD COLUMN IF NOT EXISTS remark text;