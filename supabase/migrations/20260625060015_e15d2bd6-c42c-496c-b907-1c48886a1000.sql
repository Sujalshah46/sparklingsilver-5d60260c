
-- 1. Roles
DO $$ BEGIN
  CREATE TYPE public.app_role AS ENUM ('admin','user');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users read own roles" ON public.user_roles;
CREATE POLICY "users read own roles" ON public.user_roles
  FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

DROP POLICY IF EXISTS "admins read all roles" ON public.user_roles;
CREATE POLICY "admins read all roles" ON public.user_roles
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin'));

-- 2. Admin email seed (now + on future signup)
INSERT INTO public.user_roles (user_id, role)
SELECT id, 'admin'::public.app_role FROM auth.users WHERE lower(email) = 'sujalshah7102002@gmail.com'
ON CONFLICT DO NOTHING;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name'))
  ON CONFLICT (id) DO NOTHING;
  IF lower(NEW.email) = 'sujalshah7102002@gmail.com' THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin')
    ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 3. Extend order_status enum
DO $$ BEGIN
  ALTER TYPE public.order_status ADD VALUE IF NOT EXISTS 'pending';
EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN
  ALTER TYPE public.order_status ADD VALUE IF NOT EXISTS 'accepted';
EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN
  ALTER TYPE public.order_status ADD VALUE IF NOT EXISTS 'rejected';
EXCEPTION WHEN others THEN NULL; END $$;

-- 4. Customer fields on orders
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS customer_name text,
  ADD COLUMN IF NOT EXISTS customer_phone text,
  ADD COLUMN IF NOT EXISTS customer_email text,
  ADD COLUMN IF NOT EXISTS customer_address text,
  ADD COLUMN IF NOT EXISTS customer_city text,
  ADD COLUMN IF NOT EXISTS customer_pincode text,
  ADD COLUMN IF NOT EXISTS customer_notes text,
  ADD COLUMN IF NOT EXISTS admin_notes text,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

-- updated_at trigger reuse
DROP TRIGGER IF EXISTS orders_touch_updated_at ON public.orders;
CREATE TRIGGER orders_touch_updated_at BEFORE UPDATE ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- 5. Admin policies on orders + order_items
DROP POLICY IF EXISTS "admins read all orders" ON public.orders;
CREATE POLICY "admins read all orders" ON public.orders
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin'));

DROP POLICY IF EXISTS "admins update all orders" ON public.orders;
CREATE POLICY "admins update all orders" ON public.orders
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin'));

DROP POLICY IF EXISTS "admins read all order_items" ON public.order_items;
CREATE POLICY "admins read all order_items" ON public.order_items
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin'));

-- 6. push_subscriptions
CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  endpoint text PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  p256dh text NOT NULL,
  auth text NOT NULL,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.push_subscriptions TO authenticated;
GRANT ALL ON public.push_subscriptions TO service_role;
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users manage own push subs" ON public.push_subscriptions;
CREATE POLICY "users manage own push subs" ON public.push_subscriptions
  FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- 7. Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.orders;
