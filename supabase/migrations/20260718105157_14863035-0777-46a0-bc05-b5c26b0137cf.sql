UPDATE products
SET image_url = image_url || '&v=' || EXTRACT(EPOCH FROM NOW())::bigint::text,
    updated_at = NOW()
WHERE sku IN ('AR(NK)-559','AR(NK)-514','AR(PS)-412');