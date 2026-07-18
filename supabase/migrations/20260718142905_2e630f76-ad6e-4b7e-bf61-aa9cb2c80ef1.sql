
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS homepage_featured boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS homepage_featured_order integer;

CREATE INDEX IF NOT EXISTS products_homepage_featured_idx
  ON public.products (homepage_featured_order)
  WHERE homepage_featured = true;

CREATE UNIQUE INDEX IF NOT EXISTS products_homepage_featured_order_uq
  ON public.products (homepage_featured_order)
  WHERE homepage_featured = true;

-- Enforce max 10 featured
CREATE OR REPLACE FUNCTION public.enforce_homepage_featured_cap()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  cnt int;
BEGIN
  IF NEW.homepage_featured = true AND (TG_OP = 'INSERT' OR OLD.homepage_featured IS DISTINCT FROM true) THEN
    SELECT count(*) INTO cnt FROM public.products WHERE homepage_featured = true;
    IF cnt >= 10 THEN
      RAISE EXCEPTION 'Homepage featured limit reached (max 10 SKUs).'
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS products_homepage_featured_cap ON public.products;
CREATE TRIGGER products_homepage_featured_cap
BEFORE INSERT OR UPDATE OF homepage_featured ON public.products
FOR EACH ROW EXECUTE FUNCTION public.enforce_homepage_featured_cap();

-- Auto-clear featured when archived
CREATE OR REPLACE FUNCTION public.clear_homepage_featured_on_archive()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.import_status IS DISTINCT FROM 'active' AND NEW.homepage_featured = true THEN
    NEW.homepage_featured := false;
    NEW.homepage_featured_order := NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS products_clear_homepage_on_archive ON public.products;
CREATE TRIGGER products_clear_homepage_on_archive
BEFORE UPDATE OF import_status ON public.products
FOR EACH ROW EXECUTE FUNCTION public.clear_homepage_featured_on_archive();
