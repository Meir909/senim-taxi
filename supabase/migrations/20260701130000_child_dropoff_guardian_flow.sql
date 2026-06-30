CREATE TABLE IF NOT EXISTS public.ride_dropoff_pins (
  ride_id uuid PRIMARY KEY REFERENCES public.rides(id) ON DELETE CASCADE,
  passenger_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  pin_code text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (pin_code ~ '^\d{4}$')
);

GRANT SELECT ON public.ride_dropoff_pins TO authenticated;
GRANT ALL ON public.ride_dropoff_pins TO service_role;

ALTER TABLE public.ride_dropoff_pins ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ride_dropoff_pins_select_passenger" ON public.ride_dropoff_pins;
CREATE POLICY "ride_dropoff_pins_select_passenger"
ON public.ride_dropoff_pins
FOR SELECT
TO authenticated
USING (auth.uid() = passenger_id);

ALTER TABLE public.rides
  ADD COLUMN IF NOT EXISTS recipient_full_name text,
  ADD COLUMN IF NOT EXISTS recipient_phone text,
  ADD COLUMN IF NOT EXISTS recipient_relation text,
  ADD COLUMN IF NOT EXISTS dropoff_pin_verified_at timestamptz;

CREATE OR REPLACE FUNCTION public.enforce_kid_ride_rules()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_child public.passenger_children%ROWTYPE;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF NEW.pickup_pin_verified_at IS DISTINCT FROM OLD.pickup_pin_verified_at
       AND auth.uid() IS DISTINCT FROM OLD.driver_id THEN
      RAISE EXCEPTION 'Только водитель может подтверждать PIN-код посадки';
    END IF;

    IF NEW.dropoff_pin_verified_at IS DISTINCT FROM OLD.dropoff_pin_verified_at
       AND auth.uid() IS DISTINCT FROM OLD.driver_id THEN
      RAISE EXCEPTION 'Только водитель может подтверждать PIN-код передачи';
    END IF;

    IF OLD.tariff = 'kids'
       AND NEW.status = 'in_progress'
       AND OLD.status IS DISTINCT FROM 'in_progress' THEN
      IF auth.uid() IS DISTINCT FROM OLD.driver_id THEN
        RAISE EXCEPTION 'Начать детскую поездку может только водитель';
      END IF;

      IF COALESCE(NEW.pickup_pin_verified_at, OLD.pickup_pin_verified_at) IS NULL THEN
        RAISE EXCEPTION 'Сначала подтвердите PIN-код от мамы';
      END IF;
    END IF;

    IF OLD.tariff = 'kids'
       AND NEW.status = 'completed'
       AND OLD.status IS DISTINCT FROM 'completed' THEN
      IF auth.uid() IS DISTINCT FROM OLD.driver_id THEN
        RAISE EXCEPTION 'Завершить детскую поездку может только водитель';
      END IF;

      IF COALESCE(NEW.dropoff_pin_verified_at, OLD.dropoff_pin_verified_at) IS NULL THEN
        RAISE EXCEPTION 'Сначала подтвердите PIN-код получателя';
      END IF;
    END IF;
  END IF;

  IF NEW.tariff = 'kids' THEN
    IF NOT public.is_adult_female_profile(NEW.passenger_id) THEN
      RAISE EXCEPTION 'Тариф "Для ребенка" доступен только совершеннолетним женщинам-пассажиркам';
    END IF;

    IF NEW.child_id IS NULL THEN
      RAISE EXCEPTION 'Для тарифа "Для ребенка" нужно выбрать ребёнка';
    END IF;

    IF btrim(COALESCE(NEW.recipient_full_name, '')) = '' THEN
      RAISE EXCEPTION 'Укажите ФИО получателя ребёнка';
    END IF;

    IF btrim(COALESCE(NEW.recipient_phone, '')) = '' THEN
      RAISE EXCEPTION 'Укажите телефон получателя ребёнка';
    END IF;

    IF btrim(COALESCE(NEW.recipient_relation, '')) = '' THEN
      RAISE EXCEPTION 'Укажите, кем приходится получатель';
    END IF;

    SELECT *
    INTO v_child
    FROM public.passenger_children
    WHERE id = NEW.child_id
      AND mother_id = NEW.passenger_id;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Ребёнок не найден или не принадлежит этой пассажирке';
    END IF;

    IF public.get_age_years(v_child.birth_date) >= 12 THEN
      RAISE EXCEPTION 'Тариф "Для ребенка" доступен только детям младше 12 лет';
    END IF;

    NEW.child_name := v_child.full_name;
    NEW.child_birth_date := v_child.birth_date;
    NEW.recipient_full_name := btrim(NEW.recipient_full_name);
    NEW.recipient_phone := btrim(NEW.recipient_phone);
    NEW.recipient_relation := btrim(NEW.recipient_relation);

    IF TG_OP = 'INSERT' THEN
      NEW.pickup_pin_verified_at := NULL;
      NEW.dropoff_pin_verified_at := NULL;
    END IF;
  ELSE
    NEW.child_id := NULL;
    NEW.child_name := NULL;
    NEW.child_birth_date := NULL;
    NEW.recipient_full_name := NULL;
    NEW.recipient_phone := NULL;
    NEW.recipient_relation := NULL;
    NEW.pickup_pin_verified_at := NULL;
    NEW.dropoff_pin_verified_at := NULL;
  END IF;

  RETURN NEW;
END
$$;

CREATE OR REPLACE FUNCTION public.sync_ride_dropoff_pin_secret()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.tariff = 'kids' THEN
    INSERT INTO public.ride_dropoff_pins (ride_id, passenger_id, pin_code)
    VALUES (
      NEW.id,
      NEW.passenger_id,
      lpad(((random() * 10000)::int % 10000)::text, 4, '0')
    )
    ON CONFLICT (ride_id) DO UPDATE
    SET passenger_id = EXCLUDED.passenger_id;
  ELSE
    DELETE FROM public.ride_dropoff_pins WHERE ride_id = NEW.id;
  END IF;

  RETURN NEW;
END
$$;

DROP TRIGGER IF EXISTS trg_sync_ride_dropoff_pin_secret ON public.rides;
CREATE TRIGGER trg_sync_ride_dropoff_pin_secret
AFTER INSERT OR UPDATE ON public.rides
FOR EACH ROW
EXECUTE FUNCTION public.sync_ride_dropoff_pin_secret();

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
  v_earnings numeric(10,2);
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
      cos(radians(_lat))*cos(radians(v_ride.dropoff_lat))*cos(radians(v_ride.dropoff_lng)-radians(_lng))
      + sin(radians(_lat))*sin(radians(v_ride.dropoff_lat))
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

  v_commission := ROUND(_fare * 0.20, 2);
  v_earnings := _fare - v_commission;

  UPDATE public.rides
  SET
    status = 'completed',
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

  UPDATE public.drivers SET status='online', total_rides=total_rides+1 WHERE id=auth.uid();
  INSERT INTO public.transactions (user_id, ride_id, type, amount, description)
    VALUES (auth.uid(), _ride_id, 'ride_earning', v_earnings, 'Ride earnings');
  INSERT INTO public.transactions (user_id, ride_id, type, amount, description)
    VALUES (auth.uid(), _ride_id, 'commission', -v_commission, 'Platform commission (20%)');
  UPDATE public.wallets SET balance = balance + v_earnings, updated_at=now() WHERE user_id=auth.uid();
  INSERT INTO public.notifications (user_id, title, body, type, data)
    VALUES (
      v_ride.passenger_id,
      CASE WHEN v_ride.tariff = 'kids' THEN 'Ребёнок передан получателю' ELSE 'Поездка завершена' END,
      CASE WHEN v_ride.tariff = 'kids' THEN 'Водитель подтвердил передачу ребёнка получателю' ELSE 'Спасибо за поездку!' END,
      'ride_completed',
      jsonb_build_object('ride_id', _ride_id)
    );
  RETURN v_ride;
END
$$;

REVOKE EXECUTE ON FUNCTION public.complete_ride_secure(uuid, numeric, numeric, integer, double precision, double precision, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.complete_ride_secure(uuid, numeric, numeric, integer, double precision, double precision, text) TO authenticated;
