-- ============================================
-- SPARKLING SILVER: INVENTORY PAGINATION VIEW
-- ============================================
-- Creates a view of products with pre-computed stock status
-- allowing efficient database-level pagination and filtering.

CREATE OR REPLACE VIEW public.products_inventory_view AS
SELECT 
  id, 
  name, 
  sku, 
  image_url, 
  stock_quantity, 
  low_stock_threshold, 
  in_stock, 
  category_id,
  (stock_quantity = 0) AS is_out_of_stock,
  (stock_quantity > 0 AND stock_quantity <= low_stock_threshold) AS is_low_stock
FROM public.products;

GRANT SELECT ON public.products_inventory_view TO authenticated, service_role;
