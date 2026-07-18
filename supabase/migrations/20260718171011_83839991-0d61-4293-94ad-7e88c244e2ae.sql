
-- 1) image_variants column for upload-time resized WebP URLs
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS image_variants jsonb;

COMMENT ON COLUMN public.products.image_variants IS
  'Pre-resized WebP variants: {"thumb": url300, "card": url600, "detail": url1200}. Nullable; app falls back to raw image_url when absent.';

-- 2) RPC: counts for a set of category slugs (one round trip, not N)
CREATE OR REPLACE FUNCTION public.get_category_product_counts(_slugs text[])
RETURNS TABLE(slug text, product_count bigint)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT c.slug, count(p.id)::bigint
  FROM public.categories c
  LEFT JOIN public.products p ON p.category_id = c.id
  WHERE c.slug = ANY(_slugs)
  GROUP BY c.slug;
$$;

GRANT EXECUTE ON FUNCTION public.get_category_product_counts(text[]) TO anon, authenticated, service_role;

-- 3) RPC: subcategory counts within one category (one round trip)
CREATE OR REPLACE FUNCTION public.get_subcategory_product_counts(_category_id uuid)
RETURNS TABLE(subcategory_id uuid, product_count bigint)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT s.id, count(p.id)::bigint
  FROM public.subcategories s
  LEFT JOIN public.products p
    ON p.subcategory_id = s.id
   AND p.category_id = _category_id
  GROUP BY s.id;
$$;

GRANT EXECUTE ON FUNCTION public.get_subcategory_product_counts(uuid) TO anon, authenticated, service_role;
