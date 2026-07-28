-- 1. shipments
CREATE TABLE public.shipments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  status public.order_status NOT NULL DEFAULT 'processing',
  tracking_number text,
  courier text,
  dispatched_at timestamptz,
  delivered_at timestamptz,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.shipments TO authenticated;
GRANT ALL ON public.shipments TO service_role;

ALTER TABLE public.shipments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admins manage shipments" ON public.shipments
  FOR ALL TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (private.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "users view own shipments" ON public.shipments
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.orders o WHERE o.id = shipments.order_id AND o.user_id = auth.uid()));

CREATE TRIGGER shipments_touch_updated_at
  BEFORE UPDATE ON public.shipments
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE INDEX shipments_order_id_idx ON public.shipments(order_id);

-- 2. order_items per-item status
ALTER TABLE public.order_items
  ADD COLUMN status public.order_status NOT NULL DEFAULT 'pending',
  ADD COLUMN status_updated_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN shipment_id uuid REFERENCES public.shipments(id) ON DELETE SET NULL;

CREATE INDEX order_items_shipment_id_idx ON public.order_items(shipment_id);

-- admins need to be able to update item status
CREATE POLICY "admins update order_items" ON public.order_items
  FOR UPDATE TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (private.has_role(auth.uid(), 'admin'::app_role));

-- 3. item_status_history
CREATE TABLE public.item_status_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_item_id uuid NOT NULL REFERENCES public.order_items(id) ON DELETE CASCADE,
  from_status public.order_status,
  to_status public.order_status NOT NULL,
  changed_by uuid,
  changed_at timestamptz NOT NULL DEFAULT now(),
  note text
);

GRANT SELECT, INSERT ON public.item_status_history TO authenticated;
GRANT ALL ON public.item_status_history TO service_role;

ALTER TABLE public.item_status_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admins read item history" ON public.item_status_history
  FOR SELECT TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "admins insert item history" ON public.item_status_history
  FOR INSERT TO authenticated
  WITH CHECK (private.has_role(auth.uid(), 'admin'::app_role) AND changed_by = auth.uid());

CREATE POLICY "users read own item history" ON public.item_status_history
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.order_items oi
    JOIN public.orders o ON o.id = oi.order_id
    WHERE oi.id = item_status_history.order_item_id AND o.user_id = auth.uid()
  ));

CREATE INDEX item_status_history_item_idx ON public.item_status_history(order_item_id);

-- 4. Backfill existing data
UPDATE public.order_items oi
SET status = o.status, status_updated_at = COALESCE(o.updated_at, o.created_at)
FROM public.orders o
WHERE o.id = oi.order_id;

-- one shipment per order already past confirmation
WITH new_ships AS (
  INSERT INTO public.shipments (order_id, status, tracking_number, dispatched_at, delivered_at, created_at)
  SELECT o.id,
         o.status,
         o.tracking_number,
         CASE WHEN o.status IN ('dispatched','out_for_delivery','delivered') THEN COALESCE(o.updated_at, o.created_at) END,
         CASE WHEN o.status = 'delivered' THEN COALESCE(o.updated_at, o.created_at) END,
         COALESCE(o.updated_at, o.created_at)
  FROM public.orders o
  WHERE o.status IN ('processing','ready','dispatched','out_for_delivery','delivered')
  RETURNING id, order_id
)
UPDATE public.order_items oi
SET shipment_id = ns.id
FROM new_ships ns
WHERE oi.order_id = ns.order_id;
