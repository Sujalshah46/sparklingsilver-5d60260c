
-- 1) Add column
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS stage_history jsonb NOT NULL DEFAULT '[]'::jsonb;

-- 2) Backfill: seed pending at created_at, and current status at updated_at (if different)
UPDATE public.orders
SET stage_history = (
  CASE
    WHEN status::text = 'pending' THEN
      jsonb_build_array(jsonb_build_object('status', 'pending', 'at', to_char(created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"')))
    ELSE
      jsonb_build_array(
        jsonb_build_object('status', 'pending', 'at', to_char(created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"')),
        jsonb_build_object('status', status::text, 'at', to_char(COALESCE(updated_at, created_at) AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'))
      )
  END
)
WHERE stage_history = '[]'::jsonb OR stage_history IS NULL;

-- 3) Trigger: seed pending entry on insert if empty
CREATE OR REPLACE FUNCTION public.orders_seed_stage_history()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.stage_history IS NULL OR NEW.stage_history = '[]'::jsonb THEN
    NEW.stage_history := jsonb_build_array(
      jsonb_build_object('status', COALESCE(NEW.status::text, 'pending'), 'at', to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'))
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS orders_seed_stage_history_trg ON public.orders;
CREATE TRIGGER orders_seed_stage_history_trg
BEFORE INSERT ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.orders_seed_stage_history();

-- 4) Trigger: append entry when status changes
CREATE OR REPLACE FUNCTION public.orders_append_stage_history()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    NEW.stage_history := COALESCE(OLD.stage_history, '[]'::jsonb) || jsonb_build_array(
      jsonb_build_object('status', NEW.status::text, 'at', to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'))
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS orders_append_stage_history_trg ON public.orders;
CREATE TRIGGER orders_append_stage_history_trg
BEFORE UPDATE OF status ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.orders_append_stage_history();
