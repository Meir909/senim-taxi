ALTER TYPE public.tx_type ADD VALUE IF NOT EXISTS 'ride_payment';

CREATE OR REPLACE FUNCTION public.apply_ride_financials(
  _ride_id uuid,
  _passenger_id uuid,
  _driver_id uuid,
  _fare numeric
)
RETURNS TABLE (
  commission_amount numeric,
  driver_earnings numeric,
  passenger_balance numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_commission numeric(10,2);
  v_earnings numeric(10,2);
BEGIN
  IF _fare IS NULL OR _fare <= 0 THEN
    RAISE EXCEPTION 'Стоимость поездки должна быть больше 0';
  END IF;

  INSERT INTO public.wallets (user_id)
  VALUES (_passenger_id)
  ON CONFLICT (user_id) DO NOTHING;

  INSERT INTO public.wallets (user_id)
  VALUES (_driver_id)
  ON CONFLICT (user_id) DO NOTHING;

  v_commission := ROUND(_fare * 0.17, 2);
  v_earnings := _fare - v_commission;

  UPDATE public.wallets
  SET balance = balance - _fare,
      updated_at = now()
  WHERE user_id = _passenger_id
  RETURNING balance INTO passenger_balance;

  UPDATE public.wallets
  SET balance = balance + v_earnings,
      updated_at = now()
  WHERE user_id = _driver_id;

  INSERT INTO public.transactions (user_id, ride_id, type, amount, description)
  VALUES (_passenger_id, _ride_id, 'ride_payment', -_fare, 'Оплата поездки');

  INSERT INTO public.transactions (user_id, ride_id, type, amount, description)
  VALUES (_driver_id, _ride_id, 'ride_earning', v_earnings, 'Заработок с поездки');

  INSERT INTO public.transactions (user_id, ride_id, type, amount, description)
  VALUES (_driver_id, _ride_id, 'commission', -v_commission, 'Комиссия платформы (17%)');

  IF passenger_balance < 0 THEN
    INSERT INTO public.notifications (user_id, title, body, type, data)
    VALUES (
      _passenger_id,
      'Недостаточно средств в кошельке',
      'После оплаты поездки образовался долг ' || abs(passenger_balance)::text || ' ₸. Пополните кошелёк.',
      'wallet_debt',
      jsonb_build_object(
        'ride_id', _ride_id,
        'debt_amount', abs(passenger_balance)
      )
    );
  END IF;

  commission_amount := v_commission;
  driver_earnings := v_earnings;
  RETURN NEXT;
END
$$;

REVOKE EXECUTE ON FUNCTION public.apply_ride_financials(uuid, uuid, uuid, numeric) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.complete_ride(
  _ride_id uuid,
  _fare numeric,
  _distance numeric,
  _duration integer,
  _lat double precision DEFAULT NULL,
  _lng double precision DEFAULT NULL
)
RETURNS public.rides
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ride public.rides%ROWTYPE;
  v_commission numeric(10,2);
  v_dist_m double precision;
BEGIN
  SELECT * INTO v_ride FROM public.rides WHERE id = _ride_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Поездка не найдена'; END IF;
  IF v_ride.driver_id <> auth.uid() THEN RAISE EXCEPTION 'Это не ваша поездка'; END IF;
  IF v_ride.status NOT IN ('in_progress','driver_arrived','accepted') THEN RAISE EXCEPTION 'Поездка не активна'; END IF;

  IF _lat IS NULL OR _lng IS NULL THEN
    RAISE EXCEPTION 'Не удалось определить ваше местоположение';
  END IF;

  v_dist_m := 6371000 * acos(
    LEAST(1.0, GREATEST(-1.0,
      cos(radians(_lat)) * cos(radians(v_ride.dropoff_lat)) * cos(radians(v_ride.dropoff_lng) - radians(_lng))
      + sin(radians(_lat)) * sin(radians(v_ride.dropoff_lat))
    ))
  );

  IF v_dist_m > 200 THEN
    RAISE EXCEPTION 'Подъезжайте к точке назначения (осталось % м)', round(v_dist_m)::int;
  END IF;

  SELECT f.commission_amount
  INTO v_commission
  FROM public.apply_ride_financials(_ride_id, v_ride.passenger_id, auth.uid(), _fare) f;

  UPDATE public.rides
  SET status = 'completed',
      fare_amount = _fare,
      distance_km = _distance,
      duration_min = _duration,
      commission_amount = v_commission,
      completed_at = now()
  WHERE id = _ride_id
  RETURNING * INTO v_ride;

  UPDATE public.drivers
  SET status = 'online',
      total_rides = total_rides + 1
  WHERE id = auth.uid();

  INSERT INTO public.notifications (user_id, title, body, type, data)
  VALUES (
    v_ride.passenger_id,
    'Поездка завершена',
    'Спасибо за поездку! Оплата списана с кошелька.',
    'ride_completed',
    jsonb_build_object('ride_id', _ride_id, 'fare_amount', _fare)
  );

  RETURN v_ride;
END
$$;

CREATE OR REPLACE FUNCTION public.complete_ride_secure(
  _ride_id uuid,
  _fare numeric,
  _distance numeric,
  _duration integer,
  _lat double precision DEFAULT NULL,
  _lng double precision DEFAULT NULL,
  _dropoff_pin text DEFAULT NULL
)
RETURNS public.rides
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ride public.rides%ROWTYPE;
  v_commission numeric(10,2);
  v_dist_m double precision;
  v_pin text;
BEGIN
  SELECT * INTO v_ride FROM public.rides WHERE id = _ride_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Поездка не найдена'; END IF;
  IF v_ride.driver_id <> auth.uid() THEN RAISE EXCEPTION 'Это не ваша поездка'; END IF;
  IF v_ride.status NOT IN ('in_progress','driver_arrived','accepted') THEN RAISE EXCEPTION 'Поездка не активна'; END IF;

  IF _lat IS NULL OR _lng IS NULL THEN
    RAISE EXCEPTION 'Не удалось определить ваше местоположение';
  END IF;

  v_dist_m := 6371000 * acos(
    LEAST(1.0, GREATEST(-1.0,
      cos(radians(_lat)) * cos(radians(v_ride.dropoff_lat)) * cos(radians(v_ride.dropoff_lng) - radians(_lng))
      + sin(radians(_lat)) * sin(radians(v_ride.dropoff_lat))
    ))
  );

  IF v_dist_m > 200 THEN
    RAISE EXCEPTION 'Подъезжайте к точке назначения (осталось % м)', round(v_dist_m)::int;
  END IF;

  IF v_ride.tariff = 'kids' THEN
    IF _dropoff_pin IS NULL OR _dropoff_pin !~ '^\d{4}$' THEN
      RAISE EXCEPTION 'Введите 4-значный PIN получателя';
    END IF;

    SELECT pin_code
    INTO v_pin
    FROM public.ride_dropoff_pins
    WHERE ride_id = v_ride.id
      AND passenger_id = v_ride.passenger_id;

    IF v_pin IS NULL THEN
      RAISE EXCEPTION 'PIN получателя не найден';
    END IF;

    IF _dropoff_pin <> v_pin THEN
      RAISE EXCEPTION 'Неверный PIN получателя';
    END IF;
  END IF;

  SELECT f.commission_amount
  INTO v_commission
  FROM public.apply_ride_financials(_ride_id, v_ride.passenger_id, auth.uid(), _fare) f;

  UPDATE public.rides
  SET status = 'completed',
      fare_amount = _fare,
      distance_km = _distance,
      duration_min = _duration,
      commission_amount = v_commission,
      completed_at = now(),
      dropoff_pin_verified_at = CASE
        WHEN tariff = 'kids' THEN COALESCE(dropoff_pin_verified_at, now())
        ELSE dropoff_pin_verified_at
      END
  WHERE id = _ride_id
  RETURNING * INTO v_ride;

  UPDATE public.drivers
  SET status = 'online',
      total_rides = total_rides + 1
  WHERE id = auth.uid();

  INSERT INTO public.notifications (user_id, title, body, type, data)
  VALUES (
    v_ride.passenger_id,
    CASE WHEN v_ride.tariff = 'kids' THEN 'Ребёнок передан получателю' ELSE 'Поездка завершена' END,
    CASE
      WHEN v_ride.tariff = 'kids' THEN 'Водитель подтвердил передачу ребёнка получателю. Оплата списана с кошелька.'
      ELSE 'Спасибо за поездку! Оплата списана с кошелька.'
    END,
    'ride_completed',
    jsonb_build_object('ride_id', _ride_id, 'fare_amount', _fare)
  );

  RETURN v_ride;
END
$$;
