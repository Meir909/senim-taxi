CREATE OR REPLACE FUNCTION public.get_age_years(_dob date)
RETURNS integer
LANGUAGE sql
STABLE
AS $$
  SELECT EXTRACT(YEAR FROM age(current_date, _dob))::int
$$;

CREATE OR REPLACE FUNCTION public.is_adult_female_profile(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = _user_id
      AND gender = 'female'
      AND date_of_birth IS NOT NULL
      AND public.get_age_years(date_of_birth) >= 18
  )
$$;

CREATE TABLE IF NOT EXISTS public.passenger_children (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mother_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text NOT NULL,
  birth_date date NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.passenger_children TO authenticated;
GRANT ALL ON public.passenger_children TO service_role;

ALTER TABLE public.passenger_children ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "passenger_children_select_own" ON public.passenger_children;
DROP POLICY IF EXISTS "passenger_children_insert_own" ON public.passenger_children;
DROP POLICY IF EXISTS "passenger_children_update_own" ON public.passenger_children;
DROP POLICY IF EXISTS "passenger_children_delete_own" ON public.passenger_children;

CREATE POLICY "passenger_children_select_own"
ON public.passenger_children
FOR SELECT
TO authenticated
USING (auth.uid() = mother_id);

CREATE POLICY "passenger_children_insert_own"
ON public.passenger_children
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = mother_id);

CREATE POLICY "passenger_children_update_own"
ON public.passenger_children
FOR UPDATE
TO authenticated
USING (auth.uid() = mother_id)
WITH CHECK (auth.uid() = mother_id);

CREATE POLICY "passenger_children_delete_own"
ON public.passenger_children
FOR DELETE
TO authenticated
USING (auth.uid() = mother_id);

DROP TRIGGER IF EXISTS trg_passenger_children_updated ON public.passenger_children;
CREATE TRIGGER trg_passenger_children_updated
BEFORE UPDATE ON public.passenger_children
FOR EACH ROW
EXECUTE FUNCTION public.tg_set_updated_at();

CREATE OR REPLACE FUNCTION public.validate_passenger_child()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_age int;
BEGIN
  IF NOT public.is_adult_female_profile(NEW.mother_id) THEN
    RAISE EXCEPTION 'Добавлять детей могут только совершеннолетние женщины-пассажирки';
  END IF;

  IF NEW.birth_date > current_date THEN
    RAISE EXCEPTION 'Дата рождения ребёнка не может быть в будущем';
  END IF;

  v_age := public.get_age_years(NEW.birth_date);
  IF v_age < 0 OR v_age >= 12 THEN
    RAISE EXCEPTION 'Можно добавлять только детей младше 12 лет';
  END IF;

  NEW.full_name := btrim(NEW.full_name);
  IF NEW.full_name = '' THEN
    RAISE EXCEPTION 'Укажите имя ребёнка';
  END IF;

  RETURN NEW;
END
$$;

DROP TRIGGER IF EXISTS trg_validate_passenger_child ON public.passenger_children;
CREATE TRIGGER trg_validate_passenger_child
BEFORE INSERT OR UPDATE ON public.passenger_children
FOR EACH ROW
EXECUTE FUNCTION public.validate_passenger_child();

CREATE TABLE IF NOT EXISTS public.ride_pickup_pins (
  ride_id uuid PRIMARY KEY REFERENCES public.rides(id) ON DELETE CASCADE,
  passenger_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  pin_code text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (pin_code ~ '^\d{4}$')
);

GRANT SELECT ON public.ride_pickup_pins TO authenticated;
GRANT ALL ON public.ride_pickup_pins TO service_role;

ALTER TABLE public.ride_pickup_pins ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ride_pickup_pins_select_passenger" ON public.ride_pickup_pins;
CREATE POLICY "ride_pickup_pins_select_passenger"
ON public.ride_pickup_pins
FOR SELECT
TO authenticated
USING (auth.uid() = passenger_id);

ALTER TABLE public.rides
  ADD COLUMN IF NOT EXISTS child_id uuid REFERENCES public.passenger_children(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS child_name text,
  ADD COLUMN IF NOT EXISTS child_birth_date date,
  ADD COLUMN IF NOT EXISTS pickup_pin_verified_at timestamptz;

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
      RAISE EXCEPTION 'Только водитель может подтверждать PIN-код';
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
  END IF;

  IF NEW.tariff = 'kids' THEN
    IF NOT public.is_adult_female_profile(NEW.passenger_id) THEN
      RAISE EXCEPTION 'Детский тариф доступен только совершеннолетним женщинам-пассажиркам';
    END IF;

    IF NEW.child_id IS NULL THEN
      RAISE EXCEPTION 'Для детского тарифа нужно выбрать ребёнка';
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
      RAISE EXCEPTION 'Детский тариф доступен только детям младше 12 лет';
    END IF;

    NEW.child_name := v_child.full_name;
    NEW.child_birth_date := v_child.birth_date;

    IF TG_OP = 'INSERT' THEN
      NEW.pickup_pin_verified_at := NULL;
    END IF;
  ELSE
    NEW.child_id := NULL;
    NEW.child_name := NULL;
    NEW.child_birth_date := NULL;
    NEW.pickup_pin_verified_at := NULL;
  END IF;

  RETURN NEW;
END
$$;

DROP TRIGGER IF EXISTS trg_enforce_kid_ride_rules ON public.rides;
CREATE TRIGGER trg_enforce_kid_ride_rules
BEFORE INSERT OR UPDATE ON public.rides
FOR EACH ROW
EXECUTE FUNCTION public.enforce_kid_ride_rules();

CREATE OR REPLACE FUNCTION public.sync_ride_pickup_pin_secret()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.tariff = 'kids' THEN
    INSERT INTO public.ride_pickup_pins (ride_id, passenger_id, pin_code)
    VALUES (
      NEW.id,
      NEW.passenger_id,
      lpad(((random() * 10000)::int % 10000)::text, 4, '0')
    )
    ON CONFLICT (ride_id) DO UPDATE
    SET passenger_id = EXCLUDED.passenger_id;
  ELSE
    DELETE FROM public.ride_pickup_pins WHERE ride_id = NEW.id;
  END IF;

  RETURN NEW;
END
$$;

DROP TRIGGER IF EXISTS trg_sync_ride_pickup_pin_secret ON public.rides;
CREATE TRIGGER trg_sync_ride_pickup_pin_secret
AFTER INSERT OR UPDATE ON public.rides
FOR EACH ROW
EXECUTE FUNCTION public.sync_ride_pickup_pin_secret();

CREATE OR REPLACE FUNCTION public.start_ride_with_pin(_ride_id uuid, _pin text DEFAULT NULL)
RETURNS public.rides
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ride public.rides%ROWTYPE;
  v_pin text;
BEGIN
  SELECT *
  INTO v_ride
  FROM public.rides
  WHERE id = _ride_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Поездка не найдена';
  END IF;

  IF v_ride.driver_id <> auth.uid() THEN
    RAISE EXCEPTION 'Это не ваша поездка';
  END IF;

  IF v_ride.status NOT IN ('accepted', 'driver_arriving', 'driver_arrived') THEN
    RAISE EXCEPTION 'Начать можно только активную подачу';
  END IF;

  IF v_ride.tariff = 'kids' THEN
    IF _pin IS NULL OR _pin !~ '^\d{4}$' THEN
      RAISE EXCEPTION 'Введите 4-значный PIN-код';
    END IF;

    SELECT pin_code
    INTO v_pin
    FROM public.ride_pickup_pins
    WHERE ride_id = v_ride.id
      AND passenger_id = v_ride.passenger_id;

    IF v_pin IS NULL THEN
      RAISE EXCEPTION 'PIN-код для поездки не найден';
    END IF;

    IF _pin <> v_pin THEN
      RAISE EXCEPTION 'Неверный PIN-код';
    END IF;
  END IF;

  UPDATE public.rides
  SET
    status = 'in_progress',
    started_at = COALESCE(started_at, now()),
    pickup_pin_verified_at = CASE
      WHEN tariff = 'kids' THEN COALESCE(pickup_pin_verified_at, now())
      ELSE pickup_pin_verified_at
    END
  WHERE id = _ride_id
  RETURNING * INTO v_ride;

  RETURN v_ride;
END
$$;

REVOKE EXECUTE ON FUNCTION public.start_ride_with_pin(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.start_ride_with_pin(uuid, text) TO authenticated;
