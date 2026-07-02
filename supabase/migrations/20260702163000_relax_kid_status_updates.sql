CREATE OR REPLACE FUNCTION public.enforce_kid_ride_rules()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_child public.passenger_children%ROWTYPE;
  v_needs_child_refresh boolean;
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

    IF TG_OP = 'INSERT' THEN
      NEW.recipient_full_name := btrim(COALESCE(NEW.recipient_full_name, ''));
      NEW.recipient_phone := btrim(COALESCE(NEW.recipient_phone, ''));
      NEW.recipient_relation := btrim(COALESCE(NEW.recipient_relation, ''));
    ELSE
      NEW.recipient_full_name := btrim(COALESCE(NEW.recipient_full_name, OLD.recipient_full_name, ''));
      NEW.recipient_phone := btrim(COALESCE(NEW.recipient_phone, OLD.recipient_phone, ''));
      NEW.recipient_relation := btrim(COALESCE(NEW.recipient_relation, OLD.recipient_relation, ''));
    END IF;

    IF NEW.recipient_full_name = '' THEN
      RAISE EXCEPTION 'Укажите ФИО получателя ребёнка';
    END IF;

    IF NEW.recipient_phone = '' THEN
      RAISE EXCEPTION 'Укажите телефон получателя ребёнка';
    END IF;

    IF NEW.recipient_relation = '' THEN
      RAISE EXCEPTION 'Укажите, кем приходится получатель';
    END IF;

    v_needs_child_refresh :=
      TG_OP = 'INSERT'
      OR NEW.child_id IS DISTINCT FROM OLD.child_id
      OR NEW.passenger_id IS DISTINCT FROM OLD.passenger_id
      OR OLD.child_name IS NULL
      OR OLD.child_birth_date IS NULL;

    IF v_needs_child_refresh THEN
      IF NEW.child_id IS NULL THEN
        RAISE EXCEPTION 'Для тарифа "Для ребенка" нужно выбрать ребёнка';
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
    ELSE
      NEW.child_id := COALESCE(NEW.child_id, OLD.child_id);
      NEW.child_name := COALESCE(OLD.child_name, NEW.child_name);
      NEW.child_birth_date := COALESCE(OLD.child_birth_date, NEW.child_birth_date);
    END IF;

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
