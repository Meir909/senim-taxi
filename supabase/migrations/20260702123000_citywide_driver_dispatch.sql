CREATE OR REPLACE FUNCTION public.find_nearby_drivers(
  _lat DOUBLE PRECISION,
  _lng DOUBLE PRECISION,
  _radius_km DOUBLE PRECISION DEFAULT 0
)
RETURNS TABLE (
  driver_id UUID,
  lat DOUBLE PRECISION,
  lng DOUBLE PRECISION,
  distance_km DOUBLE PRECISION
)
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT *
  FROM (
    SELECT
      dl.driver_id,
      dl.lat,
      dl.lng,
      (
        6371 * acos(
          LEAST(
            1.0,
            GREATEST(
              -1.0,
              cos(radians(_lat)) * cos(radians(dl.lat)) * cos(radians(dl.lng) - radians(_lng))
              + sin(radians(_lat)) * sin(radians(dl.lat))
            )
          )
        )
      )::double precision AS distance_km
    FROM public.driver_locations dl
    JOIN public.drivers d ON d.id = dl.driver_id
    WHERE d.status = 'online'
      AND d.verification = 'approved'
      AND dl.updated_at > now() - interval '5 seconds'
  ) x
  WHERE _radius_km IS NULL OR _radius_km <= 0 OR x.distance_km <= _radius_km
  ORDER BY x.distance_km ASC
$$;

CREATE OR REPLACE FUNCTION public.dispatch_ride(_ride_id UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ride public.rides%ROWTYPE;
  v_driver UUID;
  v_distance NUMERIC;
  v_offer_id UUID;
BEGIN
  SELECT * INTO v_ride FROM public.rides WHERE id = _ride_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Ride not found';
  END IF;
  IF v_ride.driver_id IS NOT NULL OR v_ride.status NOT IN ('requested','searching') THEN
    RETURN NULL;
  END IF;

  SELECT n.driver_id, n.distance_km
    INTO v_driver, v_distance
  FROM public.find_nearby_drivers(v_ride.pickup_lat, v_ride.pickup_lng, 0) n
  JOIN public.drivers d ON d.id = n.driver_id
  WHERE NOT EXISTS (
    SELECT 1
    FROM public.ride_offers o
    WHERE o.ride_id = _ride_id
      AND o.driver_id = n.driver_id
  )
    AND (
      v_ride.tariff <> 'kids'
      OR d.child_seat = true
    )
  ORDER BY n.distance_km
  LIMIT 1;

  IF v_driver IS NULL THEN
    UPDATE public.rides SET status = 'searching' WHERE id = _ride_id AND status = 'requested';
    RETURN NULL;
  END IF;

  INSERT INTO public.ride_offers (ride_id, driver_id, distance_km, expires_at)
    VALUES (_ride_id, v_driver, v_distance, now() + interval '30 seconds')
    RETURNING id INTO v_offer_id;

  UPDATE public.rides SET status = 'searching' WHERE id = _ride_id AND status = 'requested';

  INSERT INTO public.notifications (user_id, title, body, type, data)
    VALUES (
      v_driver,
      'New ride request',
      concat('Pickup ', round(v_distance::numeric, 2), ' km away'),
      'new_offer',
      jsonb_build_object('ride_id', _ride_id, 'offer_id', v_offer_id)
    );

  RETURN v_offer_id;
END
$$;
