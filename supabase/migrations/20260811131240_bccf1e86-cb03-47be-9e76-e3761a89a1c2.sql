
ALTER TABLE public.categories ADD COLUMN IF NOT EXISTS product_count int DEFAULT 0;

CREATE OR REPLACE FUNCTION update_category_product_count()
RETURNS TRIGGER AS $$
BEGIN
  IF (TG_OP = 'INSERT') THEN
    UPDATE categories SET product_count = product_count + 1 WHERE id = NEW.category_id;
  ELSIF (TG_OP = 'DELETE') THEN
    UPDATE categories SET product_count = product_count - 1 WHERE id = OLD.category_id;
  ELSIF (TG_OP = 'UPDATE' AND OLD.category_id IS DISTINCT FROM NEW.category_id) THEN
    IF OLD.category_id IS NOT NULL THEN
      UPDATE categories SET product_count = product_count - 1 WHERE id = OLD.category_id;
    END IF;
    IF NEW.category_id IS NOT NULL THEN
      UPDATE categories SET product_count = product_count + 1 WHERE id = NEW.category_id;
    END IF;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_product_count ON products;
CREATE TRIGGER trg_product_count
AFTER INSERT OR DELETE OR UPDATE ON products
FOR EACH ROW EXECUTE FUNCTION update_category_product_count();

UPDATE categories c
SET product_count = (SELECT count(*) FROM products p WHERE p.category_id = c.id);

ALTER TABLE public.products ADD COLUMN IF NOT EXISTS image_variants jsonb;

GRANT ALL ON public.categories TO authenticated;
GRANT ALL ON public.categories TO service_role;
GRANT ALL ON public.products TO authenticated;
GRANT ALL ON public.products TO service_role;
