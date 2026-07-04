ALTER TABLE public.order_items
  ADD COLUMN IF NOT EXISTS gross_weight numeric(10,3),
  ADD COLUMN IF NOT EXISTS net_weight numeric(10,3);

-- Backfill from products for existing rows.
UPDATE public.order_items oi
SET gross_weight = p.gross_weight,
    net_weight = p.net_weight
FROM public.products p
WHERE oi.product_id = p.id
  AND (oi.gross_weight IS NULL OR oi.net_weight IS NULL);