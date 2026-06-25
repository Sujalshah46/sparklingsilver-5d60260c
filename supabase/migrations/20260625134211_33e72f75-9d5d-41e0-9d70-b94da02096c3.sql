CREATE POLICY "Public read category images"
ON storage.objects FOR SELECT
TO anon, authenticated
USING (bucket_id = 'category-images');

CREATE POLICY "Admins upload category images"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'category-images' AND private.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins update category images"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'category-images' AND private.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins delete category images"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'category-images' AND private.has_role(auth.uid(), 'admin'));