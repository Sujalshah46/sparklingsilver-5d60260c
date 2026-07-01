
-- Add barcode & updated_at to products
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS barcode text,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

CREATE UNIQUE INDEX IF NOT EXISTS products_barcode_unique ON public.products(barcode) WHERE barcode IS NOT NULL;

DROP TRIGGER IF EXISTS trg_products_updated_at ON public.products;
CREATE TRIGGER trg_products_updated_at BEFORE UPDATE ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Extend stock_movements with action_type for scan-inventory feed
DO $$ BEGIN
  CREATE TYPE public.stock_action_type AS ENUM ('increment','decrement','edit','created','set');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.stock_movements
  ADD COLUMN IF NOT EXISTS action_type public.stock_action_type;
