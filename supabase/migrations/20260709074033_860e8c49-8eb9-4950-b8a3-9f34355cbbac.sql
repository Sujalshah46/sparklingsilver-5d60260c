ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS design_no text,
  ADD COLUMN IF NOT EXISTS item text,
  ADD COLUMN IF NOT EXISTS family text,
  ADD COLUMN IF NOT EXISTS image_path text,
  ADD COLUMN IF NOT EXISTS has_image boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS import_status text NOT NULL DEFAULT 'active';

ALTER TABLE public.products ALTER COLUMN image_url DROP NOT NULL;
ALTER TABLE public.products ALTER COLUMN price SET DEFAULT 0;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'products_import_status_check') THEN
    ALTER TABLE public.products
      ADD CONSTRAINT products_import_status_check
      CHECK (import_status IN ('active','missing_image','archived'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS products_import_status_idx ON public.products(import_status);
CREATE INDEX IF NOT EXISTS products_has_image_idx ON public.products(has_image);

DROP POLICY IF EXISTS "product-images admin write" ON storage.objects;
CREATE POLICY "product-images admin write"
  ON storage.objects FOR ALL
  TO authenticated
  USING (bucket_id = 'product-images' AND private.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (bucket_id = 'product-images' AND private.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS "product-images authenticated read" ON storage.objects;
CREATE POLICY "product-images authenticated read"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'product-images');
