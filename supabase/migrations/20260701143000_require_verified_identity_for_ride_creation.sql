CREATE OR REPLACE FUNCTION public.enforce_verified_passenger_ride()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_status public.verify_status;
BEGIN
  SELECT verification_status
  INTO v_status
  FROM public.profiles
  WHERE id = NEW.passenger_id;

  IF v_status IS DISTINCT FROM 'approved' THEN
    RAISE EXCEPTION 'Сначала подтвердите личность, чтобы создать заказ';
  END IF;

  RETURN NEW;
END
$$;

DROP TRIGGER IF EXISTS trg_enforce_verified_passenger_ride ON public.rides;
CREATE TRIGGER trg_enforce_verified_passenger_ride
BEFORE INSERT ON public.rides
FOR EACH ROW
EXECUTE FUNCTION public.enforce_verified_passenger_ride();
