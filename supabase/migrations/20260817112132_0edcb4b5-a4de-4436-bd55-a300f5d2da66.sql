CREATE OR REPLACE VIEW public.products_inventory_view WITH (security_invoker = true) AS
SELECT
  p.id,
  p.name,
  p.sku,
  p.image_url,
  p.stock_quantity,
  p.low_stock_threshold,
  p.in_stock,
  p.category_id,
  (p.stock_quantity <= 0) AS is_out_of_stock,
  (p.stock_quantity > 0 AND p.stock_quantity <= p.low_stock_threshold) AS is_low_stock
FROM public.products p;

GRANT SELECT ON public.products_inventory_view TO authenticated;
GRANT SELECT ON public.products_inventory_view TO service_role;