
-- 1. Recreate private.has_role to be sure it exists with correct signature
CREATE SCHEMA IF NOT EXISTS private;

CREATE OR REPLACE FUNCTION private.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

REVOKE ALL ON FUNCTION private.has_role(uuid, public.app_role) FROM PUBLIC;
REVOKE ALL ON SCHEMA private FROM PUBLIC, anon, authenticated;
GRANT USAGE ON SCHEMA private TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.has_role(uuid, public.app_role) TO authenticated, service_role;

-- 2. Rewrite all policies that referenced public.has_role to use private.has_role
DROP POLICY IF EXISTS "admins read all orders" ON public.orders;
CREATE POLICY "admins read all orders" ON public.orders
  FOR SELECT TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS "admins update all orders" ON public.orders;
CREATE POLICY "admins update all orders" ON public.orders
  FOR UPDATE TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (private.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS "admins read all order_items" ON public.order_items;
CREATE POLICY "admins read all order_items" ON public.order_items
  FOR SELECT TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS "admins read all roles" ON public.user_roles;
CREATE POLICY "admins read all roles" ON public.user_roles
  FOR SELECT TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS "Admins manage products" ON public.products;
CREATE POLICY "Admins manage products" ON public.products
  FOR ALL TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (private.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS "Admins read stock movements" ON public.stock_movements;
CREATE POLICY "Admins read stock movements" ON public.stock_movements
  FOR SELECT TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS "Admins insert stock movements" ON public.stock_movements;
CREATE POLICY "Admins insert stock movements" ON public.stock_movements
  FOR INSERT TO authenticated
  WITH CHECK (private.has_role(auth.uid(), 'admin'::public.app_role));

-- 3. Drop the public SECURITY DEFINER helper so it can no longer be probed via PostgREST
DROP FUNCTION IF EXISTS public.has_role(uuid, public.app_role);

-- 4. Lock down handle_new_user SECURITY DEFINER trigger function from API callers.
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;

-- 5. Remove orders from the realtime publication to prevent broadcast/PII exposure.
ALTER PUBLICATION supabase_realtime DROP TABLE public.orders;
