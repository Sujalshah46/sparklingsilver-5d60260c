ALTER TABLE public.categories ADD COLUMN IF NOT EXISTS image_url TEXT;

-- Allow admins to update categories (image_url etc.)
DROP POLICY IF EXISTS "Admins can update categories" ON public.categories;
CREATE POLICY "Admins can update categories"
ON public.categories
FOR UPDATE
TO authenticated
USING (private.has_role(auth.uid(), 'admin'))
WITH CHECK (private.has_role(auth.uid(), 'admin'));

GRANT UPDATE ON public.categories TO authenticated;