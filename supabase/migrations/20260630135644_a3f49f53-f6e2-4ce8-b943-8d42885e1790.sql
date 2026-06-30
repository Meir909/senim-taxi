CREATE OR REPLACE FUNCTION public.rate_ride(_ride_id uuid, _rating int, _comment text DEFAULT NULL)
RETURNS public.rides
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_ride public.rides%ROWTYPE; v_avg numeric;
BEGIN
  IF _rating < 1 OR _rating > 5 THEN RAISE EXCEPTION 'Оценка должна быть от 1 до 5'; END IF;
  SELECT * INTO v_ride FROM public.rides WHERE id = _ride_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Поездка не найдена'; END IF;
  IF v_ride.status <> 'completed' THEN RAISE EXCEPTION 'Можно оценивать только завершённые поездки'; END IF;

  IF auth.uid() = v_ride.passenger_id THEN
    IF v_ride.driver_rating IS NOT NULL THEN RAISE EXCEPTION 'Вы уже оценили поездку'; END IF;
    UPDATE public.rides SET driver_rating = _rating, cancellation_reason = COALESCE(_comment, cancellation_reason)
      WHERE id = _ride_id RETURNING * INTO v_ride;
    IF v_ride.driver_id IS NOT NULL THEN
      SELECT ROUND(AVG(driver_rating)::numeric, 2) INTO v_avg
        FROM public.rides WHERE driver_id = v_ride.driver_id AND driver_rating IS NOT NULL;
      UPDATE public.drivers SET rating = COALESCE(v_avg, 5.00) WHERE id = v_ride.driver_id;
    END IF;
  ELSIF auth.uid() = v_ride.driver_id THEN
    IF v_ride.passenger_rating IS NOT NULL THEN RAISE EXCEPTION 'Вы уже оценили пассажира'; END IF;
    UPDATE public.rides SET passenger_rating = _rating WHERE id = _ride_id RETURNING * INTO v_ride;
  ELSE
    RAISE EXCEPTION 'Нет доступа к поездке';
  END IF;
  RETURN v_ride;
END $$;