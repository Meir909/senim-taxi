
-- 1) Profile: blocking + rating
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS blocked_at timestamptz,
  ADD COLUMN IF NOT EXISTS blocked_reason text,
  ADD COLUMN IF NOT EXISTS blocked_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS rating numeric(3,2) NOT NULL DEFAULT 5.00;

-- 2) Admin: block / unblock
CREATE OR REPLACE FUNCTION public.admin_block_user(_user_id uuid, _reason text)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN
    RAISE EXCEPTION 'Только для администраторов';
  END IF;
  IF _user_id IS NULL THEN RAISE EXCEPTION 'user_id обязателен'; END IF;
  IF length(coalesce(trim(_reason),'')) < 2 THEN RAISE EXCEPTION 'Укажите причину блокировки'; END IF;

  UPDATE public.profiles
    SET blocked_at = now(),
        blocked_reason = trim(_reason),
        blocked_by = auth.uid(),
        verification_status = 'rejected'
    WHERE id = _user_id;

  -- Remove all roles
  DELETE FROM public.user_roles WHERE user_id = _user_id;

  -- Force driver offline if any
  UPDATE public.drivers
    SET status = 'offline', verification = 'rejected', admin_comment = trim(_reason)
    WHERE id = _user_id;

  -- Cancel any active rides as passenger
  UPDATE public.rides
    SET status = 'cancelled',
        cancelled_at = now(),
        cancellation_reason = 'blocked_by_admin'
    WHERE passenger_id = _user_id
      AND status IN ('requested','searching','accepted','driver_arriving','driver_arrived','in_progress');

  -- Cancel active rides as driver
  UPDATE public.rides
    SET status = 'cancelled',
        cancelled_at = now(),
        cancellation_reason = 'driver_blocked_by_admin'
    WHERE driver_id = _user_id
      AND status IN ('accepted','driver_arriving','driver_arrived','in_progress');

  INSERT INTO public.notifications (user_id, title, body, type, data)
    VALUES (_user_id, 'Аккаунт заблокирован', trim(_reason), 'account_blocked',
            jsonb_build_object('reason', trim(_reason)));
END $$;

CREATE OR REPLACE FUNCTION public.admin_unblock_user(_user_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN
    RAISE EXCEPTION 'Только для администраторов';
  END IF;
  UPDATE public.profiles
    SET blocked_at = NULL, blocked_reason = NULL, blocked_by = NULL
    WHERE id = _user_id;
  INSERT INTO public.user_roles (user_id, role)
    VALUES (_user_id, 'passenger') ON CONFLICT DO NOTHING;
  INSERT INTO public.notifications (user_id, title, body, type, data)
    VALUES (_user_id, 'Аккаунт разблокирован', 'Доступ восстановлен', 'account_unblocked', '{}'::jsonb);
END $$;

-- 3) rate_ride: when driver rates passenger, aggregate to profiles.rating
CREATE OR REPLACE FUNCTION public.rate_ride(_ride_id uuid, _rating integer, _comment text DEFAULT NULL::text)
RETURNS rides
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
    SELECT ROUND(AVG(passenger_rating)::numeric, 2) INTO v_avg
      FROM public.rides WHERE passenger_id = v_ride.passenger_id AND passenger_rating IS NOT NULL;
    UPDATE public.profiles SET rating = COALESCE(v_avg, 5.00) WHERE id = v_ride.passenger_id;
  ELSE
    RAISE EXCEPTION 'Нет доступа к поездке';
  END IF;
  RETURN v_ride;
END $$;

-- 4) complete_ride: geofence — driver must be within 200m of dropoff
CREATE OR REPLACE FUNCTION public.complete_ride(
  _ride_id uuid, _fare numeric, _distance numeric, _duration integer,
  _lat double precision DEFAULT NULL, _lng double precision DEFAULT NULL
)
RETURNS rides
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_ride public.rides%ROWTYPE;
  v_commission NUMERIC(10,2);
  v_earnings NUMERIC(10,2);
  v_dist_m double precision;
BEGIN
  SELECT * INTO v_ride FROM public.rides WHERE id=_ride_id FOR UPDATE;
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

  v_commission := ROUND(_fare * 0.20, 2);
  v_earnings := _fare - v_commission;
  UPDATE public.rides
    SET status='completed', fare_amount=_fare, distance_km=_distance, duration_min=_duration,
        commission_amount=v_commission, completed_at=now()
    WHERE id=_ride_id RETURNING * INTO v_ride;
  UPDATE public.drivers SET status='online', total_rides=total_rides+1 WHERE id=auth.uid();
  INSERT INTO public.transactions (user_id, ride_id, type, amount, description)
    VALUES (auth.uid(), _ride_id, 'ride_earning', v_earnings, 'Ride earnings');
  INSERT INTO public.transactions (user_id, ride_id, type, amount, description)
    VALUES (auth.uid(), _ride_id, 'commission', -v_commission, 'Platform commission (20%)');
  UPDATE public.wallets SET balance = balance + v_earnings, updated_at=now() WHERE user_id=auth.uid();
  INSERT INTO public.notifications (user_id, title, body, type, data)
    VALUES (v_ride.passenger_id, 'Поездка завершена', 'Спасибо за поездку!', 'ride_completed',
            jsonb_build_object('ride_id',_ride_id));
  RETURN v_ride;
END $$;
