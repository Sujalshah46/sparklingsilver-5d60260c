DELETE FROM public.item_status_history WHERE order_item_id IN (SELECT oi.id FROM public.order_items oi JOIN public.orders o ON o.id = oi.order_id WHERE o.order_no LIKE 'SS-E2E-%');
DELETE FROM public.order_items WHERE order_id IN (SELECT id FROM public.orders WHERE order_no LIKE 'SS-E2E-%');
DELETE FROM public.orders WHERE order_no LIKE 'SS-E2E-%';