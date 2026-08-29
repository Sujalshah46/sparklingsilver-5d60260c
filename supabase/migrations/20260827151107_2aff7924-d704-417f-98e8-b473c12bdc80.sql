-- 1. Approval-gated pricing lookup
CREATE OR REPLACE FUNCTION public.get_product_pricing(_ids uuid[])
RETURNS TABLE(product_id uuid, price numeric, making_charge_pct numeric)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_approved_user(auth.uid()) THEN
    RETURN;
  END IF;
  RETURN QUERY
    SELECT p.id, p.price, p.making_charge_pct
    FROM public.products p
    WHERE p.id = ANY(_ids);
END;
$$;

REVOKE ALL ON FUNCTION public.get_product_pricing(uuid[]) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_product_pricing(uuid[]) FROM anon;
GRANT EXECUTE ON FUNCTION public.get_product_pricing(uuid[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_product_pricing(uuid[]) TO service_role;

-- 2. Replace table-wide SELECT with per-column SELECT that excludes pricing columns
DO $$
DECLARE
  cols text;
BEGIN
  SELECT string_agg(quote_ident(column_name), ', ' ORDER BY ordinal_position)
    INTO cols
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name = 'products'
    AND column_name NOT IN ('price', 'making_charge_pct');

  EXECUTE 'REVOKE SELECT ON public.products FROM anon';
  EXECUTE 'REVOKE SELECT ON public.products FROM authenticated';
  EXECUTE format('GRANT SELECT (%s) ON public.products TO anon', cols);
  EXECUTE format('GRANT SELECT (%s) ON public.products TO authenticated', cols);
END;
$$;

-- service_role (server-side admin/maintenance) keeps full access
GRANT ALL ON public.products TO service_role;