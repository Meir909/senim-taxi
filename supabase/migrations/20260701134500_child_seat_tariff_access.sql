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
  FROM public.find_nearby_drivers(v_ride.pickup_lat, v_ride.pickup_lng, 3) n
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

CREATE OR REPLACE FUNCTION public.accept_ride_offer(_offer_id UUID)
RETURNS public.rides
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_offer public.ride_offers%ROWTYPE;
  v_ride public.rides%ROWTYPE;
  v_driver public.drivers%ROWTYPE;
BEGIN
  SELECT * INTO v_offer
  FROM public.ride_offers
  WHERE id = _offer_id
    AND driver_id = auth.uid()
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Offer not found';
  END IF;
  IF v_offer.status <> 'pending' THEN
    RAISE EXCEPTION 'Offer no longer available';
  END IF;
  IF v_offer.expires_at < now() THEN
    UPDATE public.ride_offers SET status='timeout', responded_at=now() WHERE id=_offer_id;
    RAISE EXCEPTION 'Offer expired';
  END IF;

  SELECT * INTO v_ride FROM public.rides WHERE id = v_offer.ride_id FOR UPDATE;
  IF v_ride.driver_id IS NOT NULL THEN
    UPDATE public.ride_offers SET status='cancelled', responded_at=now() WHERE id=_offer_id;
    RAISE EXCEPTION 'Ride already assigned';
  END IF;
  IF v_ride.status NOT IN ('requested','searching') THEN
    RAISE EXCEPTION 'Ride no longer available';
  END IF;

  SELECT * INTO v_driver FROM public.drivers WHERE id = auth.uid();
  IF v_ride.tariff = 'kids' AND COALESCE(v_driver.child_seat, false) = false THEN
    UPDATE public.ride_offers SET status='cancelled', responded_at=now() WHERE id=_offer_id;
    RAISE EXCEPTION 'Для детских тарифов требуется детское сиденье';
  END IF;

  UPDATE public.rides
  SET driver_id = auth.uid(), status='accepted', accepted_at=now()
  WHERE id = v_ride.id
  RETURNING * INTO v_ride;

  UPDATE public.ride_offers SET status='accepted', responded_at=now() WHERE id=_offer_id;
  UPDATE public.ride_offers
  SET status='cancelled', responded_at=now()
  WHERE ride_id = v_ride.id AND id <> _offer_id AND status='pending';

  UPDATE public.drivers SET status='on_ride' WHERE id = auth.uid();

  INSERT INTO public.notifications (user_id, title, body, type, data)
    VALUES (
      v_ride.passenger_id,
      'Driver accepted',
      'A driver is on the way',
      'ride_accepted',
      jsonb_build_object('ride_id', v_ride.id)
    );

  RETURN v_ride;
END
$$;
