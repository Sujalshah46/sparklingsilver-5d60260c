UPDATE products
SET image_url = image_url || '&v=' || EXTRACT(EPOCH FROM NOW())::bigint::text,
    updated_at = NOW()
WHERE sku = 'AR(LS)-138';