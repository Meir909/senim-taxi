
-- Dispatch a ride to the next-best available driver (excluding already-offered)
CREATE OR REPLACE FUNCTION public.dispatch_ride(_ride_id UUID)
RETURNS UUID -- returns the offer id, or NULL when no driver found
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_ride public.rides%ROWTYPE;
  v_driver UUID;
  v_distance NUMERIC;
  v_offer_id UUID;
BEGIN
  SELECT * INTO v_ride FROM public.rides WHERE id=_ride_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Ride not found'; END IF;
  IF v_ride.driver_id IS NOT NULL OR v_ride.status NOT IN ('requested','searching') THEN
    RETURN NULL;
  END IF;

  SELECT n.driver_id, n.distance_km
    INTO v_driver, v_distance
  FROM public.find_nearby_drivers(v_ride.pickup_lat, v_ride.pickup_lng, 3) n
  WHERE NOT EXISTS (
    SELECT 1 FROM public.ride_offers o
    WHERE o.ride_id = _ride_id AND o.driver_id = n.driver_id
  )
  ORDER BY n.distance_km
  LIMIT 1;

  IF v_driver IS NULL THEN
    UPDATE public.rides SET status='searching' WHERE id=_ride_id AND status='requested';
    RETURN NULL;
  END IF;

  INSERT INTO public.ride_offers (ride_id, driver_id, distance_km, expires_at)
    VALUES (_ride_id, v_driver, v_distance, now() + interval '30 seconds')
    RETURNING id INTO v_offer_id;

  UPDATE public.rides SET status='searching' WHERE id=_ride_id AND status='requested';

  INSERT INTO public.notifications (user_id, title, body, type, data)
    VALUES (v_driver, 'New ride request', concat('Pickup ', round(v_distance::numeric,2), ' km away'), 'new_offer',
            jsonb_build_object('ride_id', _ride_id, 'offer_id', v_offer_id));

  RETURN v_offer_id;
END $$;
REVOKE EXECUTE ON FUNCTION public.dispatch_ride(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.dispatch_ride(uuid) TO service_role;

-- Trigger: auto-dispatch on new ride
CREATE OR REPLACE FUNCTION public.tg_dispatch_new_ride()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.dispatch_ride(NEW.id);
  RETURN NEW;
END $$;
CREATE TRIGGER trg_dispatch_new_ride AFTER INSERT ON public.rides
  FOR EACH ROW WHEN (NEW.status IN ('requested','searching')) EXECUTE FUNCTION public.tg_dispatch_new_ride();

-- Re-dispatcher: time out expired pending offers, re-dispatch the ride.
-- After 6 failed attempts or 3 minutes of searching, mark no_drivers.
CREATE OR REPLACE FUNCTION public.expire_offers_and_redispatch()
RETURNS INT LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_count INT := 0;
  r RECORD;
BEGIN
  -- Step 1: expire pending offers
  UPDATE public.ride_offers
    SET status='timeout', responded_at=now()
    WHERE status='pending' AND expires_at < now();

  -- Step 2: for each still-searching ride with no pending offer, try next driver
  FOR r IN
    SELECT id, requested_at FROM public.rides
    WHERE status IN ('requested','searching') AND driver_id IS NULL
      AND NOT EXISTS (SELECT 1 FROM public.ride_offers o WHERE o.ride_id = rides.id AND o.status='pending')
  LOOP
    IF r.requested_at < now() - interval '3 minutes'
       OR (SELECT count(*) FROM public.ride_offers WHERE ride_id=r.id) >= 6 THEN
      UPDATE public.rides SET status='no_drivers' WHERE id=r.id;
      INSERT INTO public.notifications (user_id, title, body, type, data)
        SELECT passenger_id, 'No drivers available', 'Please try again in a moment', 'no_drivers', jsonb_build_object('ride_id', r.id)
        FROM public.rides WHERE id=r.id;
      v_count := v_count + 1;
    ELSE
      PERFORM public.dispatch_ride(r.id);
      v_count := v_count + 1;
    END IF;
  END LOOP;

  RETURN v_count;
END $$;
REVOKE EXECUTE ON FUNCTION public.expire_offers_and_redispatch() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.expire_offers_and_redispatch() TO service_role;

-- pg_cron: run every minute (smallest pg_cron grain). The DB-side trigger covers
-- the moment a ride is created; this cron handles timeouts + retries.
CREATE EXTENSION IF NOT EXISTS pg_cron;
SELECT cron.schedule('ridenow-redispatch', '* * * * *', $$SELECT public.expire_offers_and_redispatch();$$);
