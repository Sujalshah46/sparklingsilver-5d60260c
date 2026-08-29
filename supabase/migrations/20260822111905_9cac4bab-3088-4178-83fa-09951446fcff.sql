-- Signed URLs are now minted per request (1 h TTL) for signed-in users only.
-- Remove the anonymous read grants so anonymous callers cannot mint links.
DROP POLICY IF EXISTS "Public read product-images" ON storage.objects;
DROP POLICY IF EXISTS "Public read category images" ON storage.objects;

CREATE POLICY "Authenticated read category images"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'category-images');
