-- 1. Featured flag
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS is_featured boolean NOT NULL DEFAULT false;
CREATE INDEX IF NOT EXISTS products_is_featured_idx ON public.products (is_featured) WHERE is_featured;

-- 2. Approval helper (security definer: reads profiles without RLS recursion)
CREATE OR REPLACE FUNCTION public.is_approved_user(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = _user_id AND p.status = 'active'
  ) OR private.has_role(_user_id, 'admin'::app_role);
$$;

GRANT EXECUTE ON FUNCTION public.is_approved_user(uuid) TO anon, authenticated, service_role;

-- 3. Replace the wide-open product read policy
DROP POLICY IF EXISTS "products public read" ON public.products;

CREATE POLICY "anon reads featured products only"
ON public.products FOR SELECT TO anon
USING (is_featured = true);

CREATE POLICY "approved users read all, pending read featured"
ON public.products FOR SELECT TO authenticated
USING (is_featured = true OR public.is_approved_user(auth.uid()));

-- 4. New signups start pending
ALTER TABLE public.profiles ALTER COLUMN status SET DEFAULT 'pending';

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, username, business_name, contact_person, mobile, must_change_password, status)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name'),
    NEW.raw_user_meta_data->>'username',
    NEW.raw_user_meta_data->>'business_name',
    NEW.raw_user_meta_data->>'contact_person',
    NEW.raw_user_meta_data->>'mobile',
    COALESCE((NEW.raw_user_meta_data->>'must_change_password')::boolean, false),
    CASE WHEN lower(NEW.email) = 'sujalshah7102002@gmail.com' THEN 'active' ELSE 'pending' END
  )
  ON CONFLICT (id) DO NOTHING;
  IF lower(NEW.email) = 'sujalshah7102002@gmail.com' THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin')
    ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END $function$;

-- 5. Only approved accounts may place orders
DROP POLICY IF EXISTS "users create own orders" ON public.orders;
CREATE POLICY "approved users create own orders"
ON public.orders FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id AND public.is_approved_user(auth.uid()));