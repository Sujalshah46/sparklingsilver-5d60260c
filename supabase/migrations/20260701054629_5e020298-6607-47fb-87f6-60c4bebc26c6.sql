
UPDATE public.products SET category_id = NULL;
DELETE FROM public.categories;

CREATE TABLE public.subcategories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  slug text NOT NULL UNIQUE,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.subcategories TO anon, authenticated;
GRANT ALL ON public.subcategories TO service_role;
ALTER TABLE public.subcategories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Subcategories are public" ON public.subcategories FOR SELECT USING (true);
CREATE POLICY "Admins manage subcategories" ON public.subcategories FOR ALL
  USING (private.has_role(auth.uid(),'admin'::public.app_role))
  WITH CHECK (private.has_role(auth.uid(),'admin'::public.app_role));

CREATE TABLE public.category_subcategories (
  category_id uuid NOT NULL REFERENCES public.categories(id) ON DELETE CASCADE,
  subcategory_id uuid NOT NULL REFERENCES public.subcategories(id) ON DELETE CASCADE,
  PRIMARY KEY (category_id, subcategory_id)
);
GRANT SELECT ON public.category_subcategories TO anon, authenticated;
GRANT ALL ON public.category_subcategories TO service_role;
ALTER TABLE public.category_subcategories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Category-subcategory map is public" ON public.category_subcategories FOR SELECT USING (true);
CREATE POLICY "Admins manage cat-subcat map" ON public.category_subcategories FOR ALL
  USING (private.has_role(auth.uid(),'admin'::public.app_role))
  WITH CHECK (private.has_role(auth.uid(),'admin'::public.app_role));

ALTER TABLE public.products ADD COLUMN subcategory_id uuid REFERENCES public.subcategories(id) ON DELETE SET NULL;
CREATE INDEX idx_products_subcategory ON public.products(subcategory_id);

INSERT INTO public.categories (name, slug, sort_order) VALUES
  ('Antique','antique',1),('CZ','cz',2),('Open Close','open-close',3),('Victoria','victoria',4);

INSERT INTO public.subcategories (name, slug, sort_order) VALUES
  ('Bangle','bangle',1),('Belt','belt',2),('Bracelet','bracelet',3),('Bridal','bridal',4),
  ('Brooch','brooch',5),('Choker/Chik','choker-chik',6),('Choti','choti',7),('Earrings','earrings',8),
  ('Finger Ring','finger-ring',9),('Jhumka','jhumka',10),('Long Set','long-set',11),
  ('Mangal Sutra','mangal-sutra',12),('Matil','matil',13),('Necklace','necklace',14),
  ('Pendant Set','pendant-set',15),('SPN','spn',16),('Tikka','tikka',17),('Tops','tops',18),
  ('Venky','venky',19);

INSERT INTO public.category_subcategories (category_id, subcategory_id)
SELECT c.id, s.id FROM public.categories c CROSS JOIN public.subcategories s;
