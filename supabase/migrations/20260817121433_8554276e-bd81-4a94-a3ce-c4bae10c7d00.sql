CREATE OR REPLACE FUNCTION public.update_category_product_count()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  IF (TG_OP = 'INSERT') THEN
    UPDATE public.categories SET product_count = product_count + 1 WHERE id = NEW.category_id;
  ELSIF (TG_OP = 'DELETE') THEN
    UPDATE public.categories SET product_count = product_count - 1 WHERE id = OLD.category_id;
  ELSIF (TG_OP = 'UPDATE' AND OLD.category_id IS DISTINCT FROM NEW.category_id) THEN
    IF OLD.category_id IS NOT NULL THEN
      UPDATE public.categories SET product_count = product_count - 1 WHERE id = OLD.category_id;
    END IF;
    IF NEW.category_id IS NOT NULL THEN
      UPDATE public.categories SET product_count = product_count + 1 WHERE id = NEW.category_id;
    END IF;
  END IF;
  RETURN NULL;
END;
$function$;