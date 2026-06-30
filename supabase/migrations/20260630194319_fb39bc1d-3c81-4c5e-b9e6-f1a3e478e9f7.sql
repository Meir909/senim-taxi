ALTER TABLE public.rides ADD COLUMN IF NOT EXISTS pickup_wait_seconds integer;

CREATE OR REPLACE FUNCTION public.set_pickup_wait_seconds()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'in_progress' AND OLD.status IS DISTINCT FROM 'in_progress' THEN
    NEW.started_at := COALESCE(NEW.started_at, now());
    IF NEW.pickup_wait_seconds IS NULL AND NEW.requested_at IS NOT NULL THEN
      NEW.pickup_wait_seconds := GREATEST(0, EXTRACT(EPOCH FROM (NEW.started_at - NEW.requested_at))::int);
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_pickup_wait_seconds ON public.rides;
CREATE TRIGGER trg_set_pickup_wait_seconds
  BEFORE UPDATE ON public.rides
  FOR EACH ROW
  EXECUTE FUNCTION public.set_pickup_wait_seconds();