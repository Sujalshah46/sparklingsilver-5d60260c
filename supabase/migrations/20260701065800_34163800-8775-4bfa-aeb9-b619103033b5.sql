ALTER TABLE public.products ADD COLUMN IF NOT EXISTS label_code text;
CREATE UNIQUE INDEX IF NOT EXISTS products_label_code_key ON public.products (label_code) WHERE label_code IS NOT NULL;
CREATE INDEX IF NOT EXISTS products_label_code_idx ON public.products (label_code);
COMMENT ON COLUMN public.products.label_code IS 'Printed jewellery tag code, format: <CATEGORY>(<SUBCATEGORY>)-<NUMBER>, e.g. AR(CH)-196. The scannable QR value lives in barcode.';