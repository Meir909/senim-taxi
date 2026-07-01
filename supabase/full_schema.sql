-- Full Supabase schema bundle for Senim Taxi
-- Generated from supabase/migrations in execution order


-- ============================================
-- MIGRATION: 20260630121055_ef1c3430-c27b-40b7-a928-6eb59218109d.sql
-- ============================================

DO $$ BEGIN
  CREATE TYPE public.app_role AS ENUM ('passenger','driver','admin');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TYPE public.driver_status AS ENUM ('offline','online','on_ride');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TYPE public.driver_verification AS ENUM ('pending','approved','rejected');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TYPE public.ride_status AS ENUM ('requested','searching','accepted','driver_arriving','driver_arrived','in_progress','completed','cancelled','no_drivers');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TYPE public.ride_offer_status AS ENUM ('pending','accepted','rejected','timeout','cancelled');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TYPE public.payment_method AS ENUM ('cash','wallet','card_demo');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TYPE public.tx_type AS ENUM ('ride_earning','commission','withdrawal','topup','refund','adjustment');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TYPE public.tx_status AS ENUM ('pending','completed','failed','cancelled');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TYPE public.withdrawal_status AS ENUM ('pending','approved','rejected','paid');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT, phone TEXT, avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "profiles_select_any_authenticated" ON public.profiles;
CREATE POLICY "profiles_select_any_authenticated" ON public.profiles FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;
CREATE POLICY "profiles_update_own" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
DROP POLICY IF EXISTS "profiles_insert_own" ON public.profiles;
CREATE POLICY "profiles_insert_own" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);

CREATE TABLE IF NOT EXISTS public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "user_roles_select_own" ON public.user_roles;
CREATE POLICY "user_roles_select_own" ON public.user_roles FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE TABLE IF NOT EXISTS public.drivers (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  vehicle_make TEXT, vehicle_model TEXT, vehicle_plate TEXT, vehicle_color TEXT, license_number TEXT,
  verification public.driver_verification NOT NULL DEFAULT 'pending',
  status public.driver_status NOT NULL DEFAULT 'offline',
  rating NUMERIC(3,2) NOT NULL DEFAULT 5.00,
  total_rides INT NOT NULL DEFAULT 0,
  last_seen_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.drivers TO authenticated;
GRANT ALL ON public.drivers TO service_role;
ALTER TABLE public.drivers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "drivers_select_for_authenticated" ON public.drivers;
CREATE POLICY "drivers_select_for_authenticated" ON public.drivers FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "drivers_update_self" ON public.drivers;
CREATE POLICY "drivers_update_self" ON public.drivers FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
DROP POLICY IF EXISTS "drivers_insert_self" ON public.drivers;
CREATE POLICY "drivers_insert_self" ON public.drivers FOR INSERT TO authenticated WITH CHECK (auth.uid() = id AND public.has_role(auth.uid(),'driver'));

CREATE TABLE IF NOT EXISTS public.driver_locations (
  driver_id UUID PRIMARY KEY REFERENCES public.drivers(id) ON DELETE CASCADE,
  lat DOUBLE PRECISION NOT NULL, lng DOUBLE PRECISION NOT NULL,
  heading DOUBLE PRECISION, speed DOUBLE PRECISION, accuracy DOUBLE PRECISION,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.driver_locations TO authenticated;
GRANT ALL ON public.driver_locations TO service_role;
ALTER TABLE public.driver_locations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "driver_locations_self_write" ON public.driver_locations;
CREATE POLICY "driver_locations_self_write" ON public.driver_locations FOR ALL TO authenticated USING (auth.uid() = driver_id) WITH CHECK (auth.uid() = driver_id);
DROP POLICY IF EXISTS "driver_locations_read_authenticated" ON public.driver_locations;
CREATE POLICY "driver_locations_read_authenticated" ON public.driver_locations FOR SELECT TO authenticated USING (true);
CREATE INDEX IF NOT EXISTS idx_driver_locations_lat_lng ON public.driver_locations (lat, lng);

CREATE TABLE IF NOT EXISTS public.rides (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  passenger_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  driver_id UUID REFERENCES public.drivers(id) ON DELETE SET NULL,
  status public.ride_status NOT NULL DEFAULT 'requested',
  pickup_lat DOUBLE PRECISION NOT NULL, pickup_lng DOUBLE PRECISION NOT NULL, pickup_address TEXT,
  dropoff_lat DOUBLE PRECISION NOT NULL, dropoff_lng DOUBLE PRECISION NOT NULL, dropoff_address TEXT,
  distance_km NUMERIC(8,2), duration_min INT,
  fare_amount NUMERIC(10,2), commission_amount NUMERIC(10,2),
  payment_method public.payment_method NOT NULL DEFAULT 'cash',
  passenger_rating INT CHECK (passenger_rating BETWEEN 1 AND 5),
  driver_rating INT CHECK (driver_rating BETWEEN 1 AND 5),
  requested_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  accepted_at TIMESTAMPTZ, started_at TIMESTAMPTZ, completed_at TIMESTAMPTZ, cancelled_at TIMESTAMPTZ,
  cancellation_reason TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.rides TO authenticated;
GRANT ALL ON public.rides TO service_role;
ALTER TABLE public.rides ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "rides_passenger_select" ON public.rides;
CREATE POLICY "rides_passenger_select" ON public.rides FOR SELECT TO authenticated USING (auth.uid() = passenger_id);
DROP POLICY IF EXISTS "rides_driver_select" ON public.rides;
CREATE POLICY "rides_driver_select" ON public.rides FOR SELECT TO authenticated USING (auth.uid() = driver_id);
DROP POLICY IF EXISTS "rides_passenger_insert" ON public.rides;
CREATE POLICY "rides_passenger_insert" ON public.rides FOR INSERT TO authenticated WITH CHECK (auth.uid() = passenger_id);
DROP POLICY IF EXISTS "rides_passenger_update" ON public.rides;
CREATE POLICY "rides_passenger_update" ON public.rides FOR UPDATE TO authenticated USING (auth.uid() = passenger_id) WITH CHECK (auth.uid() = passenger_id);
DROP POLICY IF EXISTS "rides_driver_update" ON public.rides;
CREATE POLICY "rides_driver_update" ON public.rides FOR UPDATE TO authenticated USING (auth.uid() = driver_id) WITH CHECK (auth.uid() = driver_id);
CREATE INDEX IF NOT EXISTS idx_rides_status ON public.rides (status);
CREATE INDEX IF NOT EXISTS idx_rides_passenger ON public.rides (passenger_id, requested_at DESC);
CREATE INDEX IF NOT EXISTS idx_rides_driver ON public.rides (driver_id, requested_at DESC);

CREATE TABLE IF NOT EXISTS public.ride_offers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ride_id UUID NOT NULL REFERENCES public.rides(id) ON DELETE CASCADE,
  driver_id UUID NOT NULL REFERENCES public.drivers(id) ON DELETE CASCADE,
  status public.ride_offer_status NOT NULL DEFAULT 'pending',
  distance_km NUMERIC(8,2),
  expires_at TIMESTAMPTZ NOT NULL,
  responded_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (ride_id, driver_id)
);
GRANT SELECT, UPDATE ON public.ride_offers TO authenticated;
GRANT ALL ON public.ride_offers TO service_role;
ALTER TABLE public.ride_offers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "ride_offers_driver_select" ON public.ride_offers;
CREATE POLICY "ride_offers_driver_select" ON public.ride_offers FOR SELECT TO authenticated USING (auth.uid() = driver_id);
DROP POLICY IF EXISTS "ride_offers_passenger_select" ON public.ride_offers;
CREATE POLICY "ride_offers_passenger_select" ON public.ride_offers FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.rides r WHERE r.id = ride_id AND r.passenger_id = auth.uid()));
CREATE INDEX IF NOT EXISTS idx_ride_offers_driver_status ON public.ride_offers (driver_id, status);
CREATE INDEX IF NOT EXISTS idx_ride_offers_ride ON public.ride_offers (ride_id);

CREATE TABLE IF NOT EXISTS public.wallets (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  balance NUMERIC(12,2) NOT NULL DEFAULT 0,
  pending_balance NUMERIC(12,2) NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'USD',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.wallets TO authenticated;
GRANT ALL ON public.wallets TO service_role;
ALTER TABLE public.wallets ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "wallets_select_own" ON public.wallets;
CREATE POLICY "wallets_select_own" ON public.wallets FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS public.transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  ride_id UUID REFERENCES public.rides(id) ON DELETE SET NULL,
  type public.tx_type NOT NULL,
  status public.tx_status NOT NULL DEFAULT 'completed',
  amount NUMERIC(12,2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'USD',
  description TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.transactions TO authenticated;
GRANT ALL ON public.transactions TO service_role;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "transactions_select_own" ON public.transactions;
CREATE POLICY "transactions_select_own" ON public.transactions FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE INDEX IF NOT EXISTS idx_tx_user ON public.transactions (user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.withdrawals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id UUID NOT NULL REFERENCES public.drivers(id) ON DELETE CASCADE,
  amount NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  status public.withdrawal_status NOT NULL DEFAULT 'pending',
  card_last4 TEXT, card_holder TEXT, notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  processed_at TIMESTAMPTZ
);
GRANT SELECT, INSERT ON public.withdrawals TO authenticated;
GRANT ALL ON public.withdrawals TO service_role;
ALTER TABLE public.withdrawals ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "withdrawals_select_own" ON public.withdrawals;
CREATE POLICY "withdrawals_select_own" ON public.withdrawals FOR SELECT TO authenticated USING (auth.uid() = driver_id);
DROP POLICY IF EXISTS "withdrawals_insert_own" ON public.withdrawals;
CREATE POLICY "withdrawals_insert_own" ON public.withdrawals FOR INSERT TO authenticated WITH CHECK (auth.uid() = driver_id AND public.has_role(auth.uid(),'driver'));

CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL, body TEXT, type TEXT NOT NULL,
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, UPDATE ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "notifications_select_own" ON public.notifications;
CREATE POLICY "notifications_select_own" ON public.notifications FOR SELECT TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "notifications_update_own" ON public.notifications;
CREATE POLICY "notifications_update_own" ON public.notifications FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON public.notifications (user_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.tg_set_updated_at() RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;
DROP TRIGGER IF EXISTS trg_profiles_updated ON public.profiles;
CREATE TRIGGER trg_profiles_updated BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
DROP TRIGGER IF EXISTS trg_drivers_updated ON public.drivers;
CREATE TRIGGER trg_drivers_updated BEFORE UPDATE ON public.drivers FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
DROP TRIGGER IF EXISTS trg_rides_updated ON public.rides;
CREATE TRIGGER trg_rides_updated BEFORE UPDATE ON public.rides FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, phone)
    VALUES (NEW.id, NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'phone');
  INSERT INTO public.wallets (user_id) VALUES (NEW.id);
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'passenger') ON CONFLICT DO NOTHING;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- haversine, fixed: filter distance in outer query
CREATE OR REPLACE FUNCTION public.find_nearby_drivers(_lat DOUBLE PRECISION, _lng DOUBLE PRECISION, _radius_km DOUBLE PRECISION DEFAULT 0)
RETURNS TABLE (driver_id UUID, lat DOUBLE PRECISION, lng DOUBLE PRECISION, distance_km DOUBLE PRECISION)
LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT * FROM (
    SELECT dl.driver_id, dl.lat, dl.lng,
      (6371 * acos(
        LEAST(1.0, GREATEST(-1.0,
          cos(radians(_lat)) * cos(radians(dl.lat)) * cos(radians(dl.lng) - radians(_lng))
          + sin(radians(_lat)) * sin(radians(dl.lat))
        ))
      ))::double precision AS distance_km
    FROM public.driver_locations dl
    JOIN public.drivers d ON d.id = dl.driver_id
    WHERE d.status = 'online'
      AND d.verification = 'approved'
      AND dl.updated_at > now() - interval '5 seconds'
  ) x
  WHERE _radius_km IS NULL OR _radius_km <= 0 OR x.distance_km <= _radius_km
  ORDER BY x.distance_km ASC
$$;

CREATE OR REPLACE FUNCTION public.accept_ride_offer(_offer_id UUID)
RETURNS public.rides LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_offer public.ride_offers%ROWTYPE; v_ride public.rides%ROWTYPE;
BEGIN
  SELECT * INTO v_offer FROM public.ride_offers WHERE id = _offer_id AND driver_id = auth.uid() FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Offer not found'; END IF;
  IF v_offer.status <> 'pending' THEN RAISE EXCEPTION 'Offer no longer available'; END IF;
  IF v_offer.expires_at < now() THEN
    UPDATE public.ride_offers SET status='timeout', responded_at=now() WHERE id=_offer_id;
    RAISE EXCEPTION 'Offer expired';
  END IF;
  SELECT * INTO v_ride FROM public.rides WHERE id = v_offer.ride_id FOR UPDATE;
  IF v_ride.driver_id IS NOT NULL THEN
    UPDATE public.ride_offers SET status='cancelled', responded_at=now() WHERE id=_offer_id;
    RAISE EXCEPTION 'Ride already assigned';
  END IF;
  IF v_ride.status NOT IN ('requested','searching') THEN RAISE EXCEPTION 'Ride no longer available'; END IF;
  UPDATE public.rides SET driver_id = auth.uid(), status='accepted', accepted_at=now() WHERE id = v_ride.id RETURNING * INTO v_ride;
  UPDATE public.ride_offers SET status='accepted', responded_at=now() WHERE id=_offer_id;
  UPDATE public.ride_offers SET status='cancelled', responded_at=now()
    WHERE ride_id = v_ride.id AND id <> _offer_id AND status='pending';
  UPDATE public.drivers SET status='on_ride' WHERE id = auth.uid();
  INSERT INTO public.notifications (user_id, title, body, type, data)
    VALUES (v_ride.passenger_id, 'Driver accepted', 'A driver is on the way', 'ride_accepted', jsonb_build_object('ride_id',v_ride.id));
  RETURN v_ride;
END $$;

CREATE OR REPLACE FUNCTION public.reject_ride_offer(_offer_id UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.ride_offers SET status='rejected', responded_at=now()
    WHERE id=_offer_id AND driver_id=auth.uid() AND status='pending';
END $$;

CREATE OR REPLACE FUNCTION public.complete_ride(_ride_id UUID, _fare NUMERIC, _distance NUMERIC, _duration INT)
RETURNS public.rides LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_ride public.rides%ROWTYPE; v_commission NUMERIC(10,2); v_earnings NUMERIC(10,2);
BEGIN
  SELECT * INTO v_ride FROM public.rides WHERE id=_ride_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Ride not found'; END IF;
  IF v_ride.driver_id <> auth.uid() THEN RAISE EXCEPTION 'Not your ride'; END IF;
  IF v_ride.status NOT IN ('in_progress','driver_arrived','accepted') THEN RAISE EXCEPTION 'Ride not active'; END IF;
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
    VALUES (v_ride.passenger_id, 'Ride completed', 'Thanks for riding!', 'ride_completed', jsonb_build_object('ride_id',_ride_id));
  RETURN v_ride;
END $$;

CREATE OR REPLACE FUNCTION public.request_withdrawal(_amount NUMERIC, _card_last4 TEXT, _card_holder TEXT)
RETURNS public.withdrawals LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_bal NUMERIC; v_w public.withdrawals%ROWTYPE;
BEGIN
  IF NOT public.has_role(auth.uid(),'driver') THEN RAISE EXCEPTION 'Driver role required'; END IF;
  IF _amount < 10 THEN RAISE EXCEPTION 'Minimum withdrawal is 10'; END IF;
  SELECT balance INTO v_bal FROM public.wallets WHERE user_id=auth.uid() FOR UPDATE;
  IF v_bal < _amount THEN RAISE EXCEPTION 'Insufficient balance'; END IF;
  UPDATE public.wallets SET balance = balance - _amount, pending_balance = pending_balance + _amount, updated_at=now() WHERE user_id=auth.uid();
  INSERT INTO public.withdrawals (driver_id, amount, card_last4, card_holder)
    VALUES (auth.uid(), _amount, _card_last4, _card_holder) RETURNING * INTO v_w;
  INSERT INTO public.transactions (user_id, type, status, amount, description, metadata)
    VALUES (auth.uid(), 'withdrawal', 'pending', -_amount, 'Withdrawal request', jsonb_build_object('withdrawal_id',v_w.id));
  RETURN v_w;
END $$;

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.rides;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.ride_offers;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.driver_locations;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
ALTER TABLE public.rides REPLICA IDENTITY FULL;
ALTER TABLE public.ride_offers REPLICA IDENTITY FULL;
ALTER TABLE public.driver_locations REPLICA IDENTITY FULL;


-- ============================================
-- MIGRATION: 20260630121117_bcd880ea-9268-4eea-9ec3-ec85cbafe194.sql
-- ============================================

REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.find_nearby_drivers(double precision, double precision, double precision) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.accept_ride_offer(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.reject_ride_offer(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.complete_ride(uuid, numeric, numeric, integer) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.request_withdrawal(numeric, text, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.tg_set_updated_at() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.find_nearby_drivers(double precision, double precision, double precision) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.accept_ride_offer(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reject_ride_offer(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.complete_ride(uuid, numeric, numeric, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.request_withdrawal(numeric, text, text) TO authenticated;


-- ============================================
-- MIGRATION: 20260630121546_f7cf1ca6-5e28-4464-9728-de12a59362c8.sql
-- ============================================

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
  FROM public.find_nearby_drivers(v_ride.pickup_lat, v_ride.pickup_lng, 0) n
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
DROP TRIGGER IF EXISTS trg_dispatch_new_ride ON public.rides;
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
SELECT cron.unschedule('ridenow-redispatch')
WHERE EXISTS (
  SELECT 1
  FROM cron.job
  WHERE jobname = 'ridenow-redispatch'
);
SELECT cron.schedule('ridenow-redispatch', '* * * * *', $$SELECT public.expire_offers_and_redispatch();$$);


-- ============================================
-- MIGRATION: 20260630135126_f018806a-7e26-48a3-9e8d-7cacbf9c644c.sql
-- ============================================
CREATE OR REPLACE FUNCTION public.topup_wallet(_amount numeric, _card_last4 text)
RETURNS public.transactions
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_tx public.transactions%ROWTYPE;
BEGIN
  IF _amount <= 0 THEN RAISE EXCEPTION 'Сумма должна быть больше 0'; END IF;
  IF _amount > 1000000 THEN RAISE EXCEPTION 'Слишком большая сумма'; END IF;
  IF _card_last4 IS NULL OR _card_last4 !~ '^\d{4}$' THEN RAISE EXCEPTION 'Введите 4 цифры карты'; END IF;

  UPDATE public.wallets SET balance = balance + _amount, updated_at = now() WHERE user_id = auth.uid();
  IF NOT FOUND THEN
    INSERT INTO public.wallets (user_id, balance) VALUES (auth.uid(), _amount);
  END IF;

  INSERT INTO public.transactions (user_id, type, status, amount, description, metadata)
    VALUES (auth.uid(), 'topup', 'completed', _amount, 'Пополнение картой ****' || _card_last4, jsonb_build_object('card_last4', _card_last4, 'demo', true))
    RETURNING * INTO v_tx;

  INSERT INTO public.notifications (user_id, title, body, type, data)
    VALUES (auth.uid(), 'Кошелёк пополнен', 'Зачислено ' || _amount::text || ' ₸', 'wallet_topup', jsonb_build_object('amount', _amount));

  RETURN v_tx;
END $$;

-- ============================================
-- MIGRATION: 20260630135644_a3f49f53-f6e2-4ce8-b943-8d42885e1790.sql
-- ============================================
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

-- ============================================
-- MIGRATION: 20260630152300_15dc9a90-0cc4-4590-ba63-16b986de1dbe.sql
-- ============================================

-- Enum for verification status
DO $$ BEGIN
  CREATE TYPE public.verify_status AS ENUM ('pending','auto_approved','manual_review','approved','rejected','reupload_requested');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.verify_kind AS ENUM ('passenger','driver');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Extend profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS iin TEXT,
  ADD COLUMN IF NOT EXISTS date_of_birth DATE,
  ADD COLUMN IF NOT EXISTS gender TEXT,
  ADD COLUMN IF NOT EXISTS selfie_path TEXT,
  ADD COLUMN IF NOT EXISTS verification_status public.verify_status NOT NULL DEFAULT 'pending';

CREATE UNIQUE INDEX IF NOT EXISTS profiles_iin_unique ON public.profiles(iin) WHERE iin IS NOT NULL;

-- Allow admins to read all profiles
DROP POLICY IF EXISTS profiles_select_admin ON public.profiles;
CREATE POLICY profiles_select_admin ON public.profiles FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin'));
DROP POLICY IF EXISTS profiles_update_admin ON public.profiles;
CREATE POLICY profiles_update_admin ON public.profiles FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- Extend drivers with document paths
ALTER TABLE public.drivers
  ADD COLUMN IF NOT EXISTS selfie_path TEXT,
  ADD COLUMN IF NOT EXISTS license_photo_path TEXT,
  ADD COLUMN IF NOT EXISTS vehicle_doc_path TEXT,
  ADD COLUMN IF NOT EXISTS admin_comment TEXT;

DROP POLICY IF EXISTS drivers_update_admin ON public.drivers;
CREATE POLICY drivers_update_admin ON public.drivers FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- Verification requests queue
CREATE TABLE IF NOT EXISTS public.verification_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind public.verify_kind NOT NULL,
  status public.verify_status NOT NULL DEFAULT 'pending',
  full_name TEXT,
  iin TEXT,
  date_of_birth DATE,
  gender TEXT,
  selfie_path TEXT NOT NULL,
  document_path TEXT,
  license_photo_path TEXT,
  vehicle_doc_path TEXT,
  ai_confidence NUMERIC(4,3),
  ai_reason TEXT,
  reviewer_id UUID REFERENCES auth.users(id),
  reviewer_comment TEXT,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.verification_requests TO authenticated;
GRANT ALL ON public.verification_requests TO service_role;

ALTER TABLE public.verification_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS vr_select_own_or_admin ON public.verification_requests;
CREATE POLICY vr_select_own_or_admin ON public.verification_requests FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(),'admin'));
DROP POLICY IF EXISTS vr_insert_own ON public.verification_requests;
CREATE POLICY vr_insert_own ON public.verification_requests FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS vr_update_admin ON public.verification_requests;
CREATE POLICY vr_update_admin ON public.verification_requests FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

DROP TRIGGER IF EXISTS trg_vr_updated ON public.verification_requests;
CREATE TRIGGER trg_vr_updated BEFORE UPDATE ON public.verification_requests
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

CREATE INDEX IF NOT EXISTS vr_status_idx ON public.verification_requests(status, created_at DESC);
CREATE INDEX IF NOT EXISTS vr_user_idx ON public.verification_requests(user_id, created_at DESC);

-- RPC: submit passenger verification
CREATE OR REPLACE FUNCTION public.submit_passenger_verification(
  _full_name TEXT, _iin TEXT, _dob DATE, _gender TEXT,
  _selfie_path TEXT, _ai_confidence NUMERIC, _ai_reason TEXT
) RETURNS verification_requests
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_req verification_requests%ROWTYPE; v_status verify_status;
BEGIN
  IF _iin IS NULL OR _iin !~ '^\d{12}$' THEN RAISE EXCEPTION 'ИИН должен содержать 12 цифр'; END IF;
  IF _selfie_path IS NULL OR length(_selfie_path) < 3 THEN RAISE EXCEPTION 'Селфи обязательно'; END IF;
  IF _full_name IS NULL OR length(trim(_full_name)) < 2 THEN RAISE EXCEPTION 'Укажите ФИО'; END IF;

  v_status := CASE WHEN _ai_confidence IS NOT NULL AND _ai_confidence >= 0.85
                   THEN 'auto_approved'::verify_status
                   ELSE 'manual_review'::verify_status END;

  INSERT INTO verification_requests (user_id, kind, status, full_name, iin, date_of_birth, gender,
    selfie_path, ai_confidence, ai_reason)
  VALUES (auth.uid(), 'passenger', v_status, _full_name, _iin, _dob, _gender,
    _selfie_path, _ai_confidence, _ai_reason)
  RETURNING * INTO v_req;

  UPDATE profiles SET
    full_name = COALESCE(_full_name, full_name),
    iin = _iin,
    date_of_birth = _dob,
    gender = _gender,
    selfie_path = _selfie_path,
    verification_status = v_status
  WHERE id = auth.uid();

  INSERT INTO notifications (user_id, title, body, type, data)
    VALUES (auth.uid(),
      CASE WHEN v_status='auto_approved' THEN 'Аккаунт подтверждён' ELSE 'Заявка на проверке' END,
      CASE WHEN v_status='auto_approved' THEN 'Личность успешно подтверждена' ELSE 'Ожидайте решения администратора' END,
      'verification', jsonb_build_object('request_id', v_req.id, 'status', v_status));

  RETURN v_req;
END $$;

-- RPC: submit driver verification (drivers always go to manual review)
CREATE OR REPLACE FUNCTION public.submit_driver_verification(
  _selfie_path TEXT, _license_path TEXT, _vehicle_doc_path TEXT,
  _ai_confidence NUMERIC, _ai_reason TEXT
) RETURNS verification_requests
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_req verification_requests%ROWTYPE; v_profile profiles%ROWTYPE;
BEGIN
  IF _selfie_path IS NULL THEN RAISE EXCEPTION 'Селфи обязательно'; END IF;
  IF _license_path IS NULL THEN RAISE EXCEPTION 'Фото ВУ обязательно'; END IF;

  SELECT * INTO v_profile FROM profiles WHERE id = auth.uid();
  IF v_profile.iin IS NULL THEN RAISE EXCEPTION 'Сначала подтвердите личность как пассажир (ИИН + селфи)'; END IF;

  INSERT INTO verification_requests (user_id, kind, status, full_name, iin, date_of_birth, gender,
    selfie_path, license_photo_path, vehicle_doc_path, ai_confidence, ai_reason)
  VALUES (auth.uid(), 'driver', 'manual_review', v_profile.full_name, v_profile.iin, v_profile.date_of_birth,
    v_profile.gender, _selfie_path, _license_path, _vehicle_doc_path, _ai_confidence, _ai_reason)
  RETURNING * INTO v_req;

  UPDATE drivers SET
    selfie_path = _selfie_path,
    license_photo_path = _license_path,
    vehicle_doc_path = _vehicle_doc_path,
    verification = 'pending'
  WHERE id = auth.uid();

  RETURN v_req;
END $$;

-- RPC: admin review
CREATE OR REPLACE FUNCTION public.admin_review_verification(
  _request_id UUID, _decision TEXT, _comment TEXT
) RETURNS verification_requests
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_req verification_requests%ROWTYPE; v_new verify_status;
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'Только для администраторов'; END IF;
  IF _decision NOT IN ('approve','reject','reupload') THEN RAISE EXCEPTION 'Неверное решение'; END IF;

  v_new := CASE _decision
    WHEN 'approve'  THEN 'approved'::verify_status
    WHEN 'reject'   THEN 'rejected'::verify_status
    WHEN 'reupload' THEN 'reupload_requested'::verify_status
  END;

  UPDATE verification_requests SET
    status = v_new,
    reviewer_id = auth.uid(),
    reviewer_comment = _comment,
    reviewed_at = now()
  WHERE id = _request_id RETURNING * INTO v_req;
  IF NOT FOUND THEN RAISE EXCEPTION 'Заявка не найдена'; END IF;

  IF v_req.kind = 'passenger' THEN
    UPDATE profiles SET verification_status = v_new WHERE id = v_req.user_id;
  ELSE
    UPDATE drivers SET
      verification = CASE _decision WHEN 'approve' THEN 'approved'::driver_verification
                                    WHEN 'reject' THEN 'rejected'::driver_verification
                                    ELSE 'pending'::driver_verification END,
      admin_comment = _comment
    WHERE id = v_req.user_id;
  END IF;

  INSERT INTO notifications (user_id, title, body, type, data)
    VALUES (v_req.user_id,
      CASE _decision WHEN 'approve' THEN 'Верификация одобрена'
                     WHEN 'reject'  THEN 'Верификация отклонена'
                     ELSE 'Требуется перезагрузка документов' END,
      COALESCE(_comment, ''), 'verification',
      jsonb_build_object('request_id', v_req.id, 'status', v_new));

  RETURN v_req;
END $$;


-- ============================================
-- MIGRATION: 20260630152329_c79d7070-bde9-4a25-b808-65a6228c060c.sql
-- ============================================

INSERT INTO storage.buckets (id, name, public)
VALUES ('verification', 'verification', false)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS ver_owner_insert ON storage.objects;
CREATE POLICY ver_owner_insert ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id='verification' AND (storage.foldername(name))[1] = auth.uid()::text);
DROP POLICY IF EXISTS ver_owner_select ON storage.objects;
CREATE POLICY ver_owner_select ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id='verification' AND ((storage.foldername(name))[1] = auth.uid()::text OR public.has_role(auth.uid(),'admin')));
DROP POLICY IF EXISTS ver_owner_update ON storage.objects;
CREATE POLICY ver_owner_update ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id='verification' AND (storage.foldername(name))[1] = auth.uid()::text);
DROP POLICY IF EXISTS ver_owner_delete ON storage.objects;
CREATE POLICY ver_owner_delete ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id='verification' AND (storage.foldername(name))[1] = auth.uid()::text);


-- ============================================
-- MIGRATION: 20260630152726_18bc727c-8a44-4c7d-aea8-b40ca7dd45cf.sql
-- ============================================

CREATE OR REPLACE FUNCTION public.submit_passenger_verification(
  _full_name TEXT, _iin TEXT, _dob DATE, _gender TEXT,
  _selfie_path TEXT, _ai_confidence NUMERIC, _ai_reason TEXT
) RETURNS verification_requests
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_req verification_requests%ROWTYPE; v_status verify_status;
BEGIN
  IF _iin IS NULL OR _iin !~ '^\d{12}$' THEN RAISE EXCEPTION 'ИИН должен содержать 12 цифр'; END IF;
  IF _selfie_path IS NULL OR length(_selfie_path) < 3 THEN RAISE EXCEPTION 'Селфи обязательно'; END IF;
  IF _full_name IS NULL OR length(trim(_full_name)) < 2 THEN RAISE EXCEPTION 'Укажите ФИО'; END IF;

  v_status := CASE WHEN _ai_confidence IS NOT NULL AND _ai_confidence >= 0.85
                   THEN 'auto_approved'::verify_status
                   ELSE 'manual_review'::verify_status END;

  INSERT INTO verification_requests (user_id, kind, status, full_name, iin, date_of_birth, gender,
    selfie_path, ai_confidence, ai_reason)
  VALUES (auth.uid(), 'passenger', v_status, _full_name, _iin, _dob, _gender,
    _selfie_path, _ai_confidence, NULLIF(_ai_reason, ''))
  RETURNING * INTO v_req;

  UPDATE profiles SET
    full_name = COALESCE(_full_name, full_name),
    iin = _iin,
    date_of_birth = _dob,
    gender = _gender,
    selfie_path = _selfie_path,
    verification_status = v_status
  WHERE id = auth.uid();

  INSERT INTO notifications (user_id, title, body, type, data)
    VALUES (auth.uid(),
      CASE WHEN v_status='auto_approved' THEN 'Аккаунт подтверждён' ELSE 'Заявка на проверке' END,
      CASE WHEN v_status='auto_approved' THEN 'Личность успешно подтверждена' ELSE 'Ожидайте решения администратора' END,
      'verification', jsonb_build_object('request_id', v_req.id, 'status', v_status));

  RETURN v_req;
END $$;

CREATE OR REPLACE FUNCTION public.submit_driver_verification(
  _selfie_path TEXT, _license_path TEXT, _vehicle_doc_path TEXT,
  _ai_confidence NUMERIC, _ai_reason TEXT
) RETURNS verification_requests
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_req verification_requests%ROWTYPE; v_profile profiles%ROWTYPE;
BEGIN
  IF _selfie_path IS NULL THEN RAISE EXCEPTION 'Селфи обязательно'; END IF;
  IF _license_path IS NULL THEN RAISE EXCEPTION 'Фото ВУ обязательно'; END IF;

  SELECT * INTO v_profile FROM profiles WHERE id = auth.uid();
  IF v_profile.iin IS NULL THEN RAISE EXCEPTION 'Сначала подтвердите личность как пассажир (ИИН + селфи)'; END IF;

  INSERT INTO verification_requests (user_id, kind, status, full_name, iin, date_of_birth, gender,
    selfie_path, license_photo_path, vehicle_doc_path, ai_confidence, ai_reason)
  VALUES (auth.uid(), 'driver', 'manual_review', v_profile.full_name, v_profile.iin, v_profile.date_of_birth,
    v_profile.gender, _selfie_path, _license_path, NULLIF(_vehicle_doc_path, ''),
    _ai_confidence, NULLIF(_ai_reason, ''))
  RETURNING * INTO v_req;

  UPDATE drivers SET
    selfie_path = _selfie_path,
    license_photo_path = _license_path,
    vehicle_doc_path = NULLIF(_vehicle_doc_path, ''),
    verification = 'pending'
  WHERE id = auth.uid();

  RETURN v_req;
END $$;

CREATE OR REPLACE FUNCTION public.admin_review_verification(
  _request_id UUID, _decision TEXT, _comment TEXT
) RETURNS verification_requests
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_req verification_requests%ROWTYPE; v_new verify_status;
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'Только для администраторов'; END IF;
  IF _decision NOT IN ('approve','reject','reupload') THEN RAISE EXCEPTION 'Неверное решение'; END IF;

  v_new := CASE _decision
    WHEN 'approve'  THEN 'approved'::verify_status
    WHEN 'reject'   THEN 'rejected'::verify_status
    WHEN 'reupload' THEN 'reupload_requested'::verify_status
  END;

  UPDATE verification_requests SET
    status = v_new,
    reviewer_id = auth.uid(),
    reviewer_comment = NULLIF(_comment, ''),
    reviewed_at = now()
  WHERE id = _request_id RETURNING * INTO v_req;
  IF NOT FOUND THEN RAISE EXCEPTION 'Заявка не найдена'; END IF;

  IF v_req.kind = 'passenger' THEN
    UPDATE profiles SET verification_status = v_new WHERE id = v_req.user_id;
  ELSE
    UPDATE drivers SET
      verification = CASE _decision WHEN 'approve' THEN 'approved'::driver_verification
                                    WHEN 'reject' THEN 'rejected'::driver_verification
                                    ELSE 'pending'::driver_verification END,
      admin_comment = NULLIF(_comment, '')
    WHERE id = v_req.user_id;
  END IF;

  INSERT INTO notifications (user_id, title, body, type, data)
    VALUES (v_req.user_id,
      CASE _decision WHEN 'approve' THEN 'Верификация одобрена'
                     WHEN 'reject'  THEN 'Верификация отклонена'
                     ELSE 'Требуется перезагрузка документов' END,
      COALESCE(NULLIF(_comment, ''), ''), 'verification',
      jsonb_build_object('request_id', v_req.id, 'status', v_new));

  RETURN v_req;
END $$;


-- ============================================
-- MIGRATION: 20260630175107_33d0ccab-62ab-4e44-b8eb-300b042177c1.sql
-- ============================================
CREATE OR REPLACE FUNCTION public.submit_passenger_verification(_full_name text, _iin text, _dob date, _gender text, _selfie_path text, _ai_confidence numeric, _ai_reason text)
RETURNS verification_requests
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE v_req verification_requests%ROWTYPE; v_status verify_status;
BEGIN
  IF _iin IS NULL OR _iin !~ '^\d{12}$' THEN RAISE EXCEPTION 'ИИН должен содержать 12 цифр'; END IF;
  IF _selfie_path IS NULL OR length(_selfie_path) < 3 THEN RAISE EXCEPTION 'Селфи обязательно'; END IF;
  IF _full_name IS NULL OR length(trim(_full_name)) < 2 THEN RAISE EXCEPTION 'Укажите ФИО'; END IF;
  IF _gender IS DISTINCT FROM 'female' THEN
    RAISE EXCEPTION 'Сервис доступен только женщинам';
  END IF;
  IF _dob IS NULL OR _dob > (CURRENT_DATE - INTERVAL '18 years')::date THEN
    RAISE EXCEPTION 'Возраст должен быть не менее 18 лет';
  END IF;

  v_status := CASE WHEN _ai_confidence IS NOT NULL AND _ai_confidence >= 0.85
                   THEN 'auto_approved'::verify_status
                   ELSE 'manual_review'::verify_status END;

  INSERT INTO verification_requests (user_id, kind, status, full_name, iin, date_of_birth, gender,
    selfie_path, ai_confidence, ai_reason)
  VALUES (auth.uid(), 'passenger', v_status, _full_name, _iin, _dob, _gender,
    _selfie_path, _ai_confidence, NULLIF(_ai_reason, ''))
  RETURNING * INTO v_req;

  UPDATE profiles SET
    full_name = COALESCE(_full_name, full_name),
    iin = _iin,
    date_of_birth = _dob,
    gender = _gender,
    selfie_path = _selfie_path,
    verification_status = v_status
  WHERE id = auth.uid();

  INSERT INTO notifications (user_id, title, body, type, data)
    VALUES (auth.uid(),
      CASE WHEN v_status='auto_approved' THEN 'Аккаунт подтверждён' ELSE 'Заявка на проверке' END,
      CASE WHEN v_status='auto_approved' THEN 'Личность успешно подтверждена' ELSE 'Ожидайте решения администратора' END,
      'verification', jsonb_build_object('request_id', v_req.id, 'status', v_status));

  RETURN v_req;
END $function$;

-- ============================================
-- MIGRATION: 20260630181352_e9b2c0de-4f14-4ac4-baad-fa70d156f66d.sql
-- ============================================

-- Profiles: name parts + verification audit
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS first_name text,
  ADD COLUMN IF NOT EXISTS last_name text,
  ADD COLUMN IF NOT EXISTS patronymic text,
  ADD COLUMN IF NOT EXISTS live_photo_url text,
  ADD COLUMN IF NOT EXISTS verification_comment text,
  ADD COLUMN IF NOT EXISTS verified_at timestamptz,
  ADD COLUMN IF NOT EXISTS verified_by uuid REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE UNIQUE INDEX IF NOT EXISTS profiles_iin_unique ON public.profiles (iin) WHERE iin IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS profiles_phone_unique ON public.profiles (phone) WHERE phone IS NOT NULL;

-- Enums
DO $$ BEGIN
  CREATE TYPE public.driver_app_status AS ENUM ('pending','needs_reupload','approved','rejected');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TYPE public.driver_doc_kind AS ENUM ('identity','license','vehicle_registration','vehicle_documents');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TYPE public.driver_doc_status AS ENUM ('pending','approved','rejected');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Drivers extensions
ALTER TABLE public.drivers
  ADD COLUMN IF NOT EXISTS first_name text,
  ADD COLUMN IF NOT EXISTS last_name text,
  ADD COLUMN IF NOT EXISTS patronymic text,
  ADD COLUMN IF NOT EXISTS vehicle_country text,
  ADD COLUMN IF NOT EXISTS child_seat boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS application_status public.driver_app_status NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS submitted_at timestamptz,
  ADD COLUMN IF NOT EXISTS reviewed_at timestamptz,
  ADD COLUMN IF NOT EXISTS reviewed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS review_comment text;

-- driver_documents
CREATE TABLE IF NOT EXISTS public.driver_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind public.driver_doc_kind NOT NULL,
  file_path text NOT NULL,
  mime_type text NOT NULL,
  status public.driver_doc_status NOT NULL DEFAULT 'pending',
  comment text,
  uploaded_at timestamptz NOT NULL DEFAULT now(),
  reviewed_at timestamptz,
  reviewed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  UNIQUE(driver_id, kind)
);
GRANT SELECT, INSERT, UPDATE ON public.driver_documents TO authenticated;
GRANT ALL ON public.driver_documents TO service_role;
ALTER TABLE public.driver_documents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Drivers read own documents" ON public.driver_documents;
CREATE POLICY "Drivers read own documents"
  ON public.driver_documents FOR SELECT TO authenticated
  USING (driver_id = auth.uid() OR public.has_role(auth.uid(),'admin'));

DROP POLICY IF EXISTS "Drivers insert own documents" ON public.driver_documents;
CREATE POLICY "Drivers insert own documents"
  ON public.driver_documents FOR INSERT TO authenticated
  WITH CHECK (driver_id = auth.uid());

DROP POLICY IF EXISTS "Drivers update own pending docs" ON public.driver_documents;
CREATE POLICY "Drivers update own pending docs"
  ON public.driver_documents FOR UPDATE TO authenticated
  USING (driver_id = auth.uid() OR public.has_role(auth.uid(),'admin'))
  WITH CHECK (driver_id = auth.uid() OR public.has_role(auth.uid(),'admin'));

DROP POLICY IF EXISTS "Admins read all drivers" ON public.drivers;
CREATE POLICY "Admins read all drivers"
  ON public.drivers FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin'));

DROP POLICY IF EXISTS "Admins read all verification files" ON storage.objects;
CREATE POLICY "Admins read all verification files"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'verification' AND public.has_role(auth.uid(),'admin'));

-- handle_new_user: capture name parts/phone/iin/dob/gender + dup checks
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $func$
DECLARE
  v_first text := NULLIF(trim(NEW.raw_user_meta_data->>'first_name'),'');
  v_last  text := NULLIF(trim(NEW.raw_user_meta_data->>'last_name'),'');
  v_patr  text := NULLIF(trim(NEW.raw_user_meta_data->>'patronymic'),'');
  v_iin   text := NULLIF(trim(NEW.raw_user_meta_data->>'iin'),'');
  v_dob   date := NULLIF(NEW.raw_user_meta_data->>'date_of_birth','')::date;
  v_gen   text := NULLIF(NEW.raw_user_meta_data->>'gender','');
  v_phone text := NULLIF(trim(NEW.raw_user_meta_data->>'phone'),'');
  v_full  text := COALESCE(NULLIF(trim(NEW.raw_user_meta_data->>'full_name'),''),
                           NULLIF(trim(concat_ws(' ', v_last, v_first, v_patr)),''));
BEGIN
  IF v_iin IS NOT NULL AND EXISTS (SELECT 1 FROM public.profiles WHERE iin = v_iin) THEN
    RAISE EXCEPTION 'Этот ИИН уже зарегистрирован' USING ERRCODE = '23505';
  END IF;
  IF v_phone IS NOT NULL AND EXISTS (SELECT 1 FROM public.profiles WHERE phone = v_phone) THEN
    RAISE EXCEPTION 'Этот номер телефона уже зарегистрирован' USING ERRCODE = '23505';
  END IF;
  INSERT INTO public.profiles (id, full_name, first_name, last_name, patronymic, phone, iin, date_of_birth, gender)
    VALUES (NEW.id, v_full, v_first, v_last, v_patr, v_phone, v_iin, v_dob, v_gen);
  INSERT INTO public.wallets (user_id) VALUES (NEW.id);
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'passenger') ON CONFLICT DO NOTHING;
  RETURN NEW;
END $func$;

-- Helper: upsert a single doc
CREATE OR REPLACE FUNCTION public._upsert_driver_doc(
  _user uuid, _kind public.driver_doc_kind, _path text, _mime text
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $func$
BEGIN
  IF _path IS NULL OR length(trim(_path)) < 3 THEN
    RAISE EXCEPTION 'Не загружен документ: %', _kind;
  END IF;
  IF _mime NOT IN ('application/pdf','image/jpeg','image/png') THEN
    RAISE EXCEPTION 'Неподдерживаемый формат файла: %', _mime;
  END IF;
  INSERT INTO public.driver_documents (driver_id, kind, file_path, mime_type, status, uploaded_at)
    VALUES (_user, _kind, _path, _mime, 'pending', now())
    ON CONFLICT (driver_id, kind) DO UPDATE SET
      file_path = EXCLUDED.file_path,
      mime_type = EXCLUDED.mime_type,
      status = 'pending',
      comment = NULL,
      uploaded_at = now(),
      reviewed_at = NULL,
      reviewed_by = NULL;
END $func$;

-- Submit driver application
CREATE OR REPLACE FUNCTION public.submit_driver_application(
  _first_name text, _last_name text, _patronymic text,
  _vehicle_plate text, _vehicle_country text, _child_seat boolean,
  _identity_path text, _identity_mime text,
  _license_path text, _license_mime text,
  _vehicle_registration_path text, _vehicle_registration_mime text,
  _vehicle_documents_path text, _vehicle_documents_mime text
) RETURNS public.drivers
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $func$
DECLARE v_profile public.profiles%ROWTYPE; v_drv public.drivers%ROWTYPE;
BEGIN
  SELECT * INTO v_profile FROM public.profiles WHERE id = auth.uid();
  IF v_profile.id IS NULL THEN RAISE EXCEPTION 'Профиль не найден'; END IF;
  IF v_profile.verification_status <> 'approved' THEN
    RAISE EXCEPTION 'Сначала пройдите подтверждение личности как пассажир';
  END IF;
  IF v_profile.gender IS DISTINCT FROM 'female' THEN
    RAISE EXCEPTION 'Только женщины могут зарегистрироваться в качестве водителя.';
  END IF;
  IF _vehicle_plate IS NULL OR length(trim(_vehicle_plate)) < 2 THEN RAISE EXCEPTION 'Укажите госномер'; END IF;
  IF _vehicle_country IS NULL OR length(trim(_vehicle_country)) < 2 THEN RAISE EXCEPTION 'Укажите страну авто'; END IF;
  IF _child_seat IS NULL THEN RAISE EXCEPTION 'Укажите наличие детского кресла'; END IF;

  INSERT INTO public.drivers (id, first_name, last_name, patronymic, vehicle_plate, vehicle_country, child_seat,
                              application_status, submitted_at, status, verification)
  VALUES (auth.uid(),
    COALESCE(NULLIF(trim(_first_name),''), v_profile.first_name),
    COALESCE(NULLIF(trim(_last_name),''),  v_profile.last_name),
    NULLIF(trim(_patronymic),''),
    trim(_vehicle_plate), trim(_vehicle_country), _child_seat,
    'pending'::driver_app_status, now(), 'offline', 'pending')
  ON CONFLICT (id) DO UPDATE SET
    first_name = EXCLUDED.first_name,
    last_name  = EXCLUDED.last_name,
    patronymic = EXCLUDED.patronymic,
    vehicle_plate = EXCLUDED.vehicle_plate,
    vehicle_country = EXCLUDED.vehicle_country,
    child_seat = EXCLUDED.child_seat,
    application_status = 'pending'::driver_app_status,
    submitted_at = now(),
    review_comment = NULL,
    verification = 'pending'
  RETURNING * INTO v_drv;

  INSERT INTO public.user_roles (user_id, role) VALUES (auth.uid(),'driver') ON CONFLICT DO NOTHING;

  PERFORM public._upsert_driver_doc(auth.uid(),'identity',             _identity_path,             _identity_mime);
  PERFORM public._upsert_driver_doc(auth.uid(),'license',              _license_path,              _license_mime);
  PERFORM public._upsert_driver_doc(auth.uid(),'vehicle_registration', _vehicle_registration_path, _vehicle_registration_mime);
  PERFORM public._upsert_driver_doc(auth.uid(),'vehicle_documents',    _vehicle_documents_path,    _vehicle_documents_mime);

  INSERT INTO public.notifications (user_id, title, body, type, data)
    VALUES (auth.uid(),'Заявка водителя отправлена','Документы переданы на проверку','driver_submitted',
            jsonb_build_object('driver_id', auth.uid()));
  RETURN v_drv;
END $func$;

-- Re-upload one document
CREATE OR REPLACE FUNCTION public.reupload_driver_document(
  _kind public.driver_doc_kind, _path text, _mime text
) RETURNS public.driver_documents
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $func$
DECLARE v_doc public.driver_documents%ROWTYPE;
BEGIN
  PERFORM public._upsert_driver_doc(auth.uid(), _kind, _path, _mime);
  SELECT * INTO v_doc FROM public.driver_documents WHERE driver_id = auth.uid() AND kind = _kind;
  UPDATE public.drivers SET
    application_status = 'pending'::driver_app_status,
    review_comment = NULL,
    verification = 'pending'
    WHERE id = auth.uid();
  RETURN v_doc;
END $func$;

-- Admin: review a single document
CREATE OR REPLACE FUNCTION public.admin_review_document(
  _doc_id uuid, _decision text, _comment text
) RETURNS public.driver_documents
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $func$
DECLARE v_doc public.driver_documents%ROWTYPE;
        v_total int; v_approved int; v_rejected int;
        v_driver uuid;
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'Только для администраторов'; END IF;
  IF _decision NOT IN ('approve','reject') THEN RAISE EXCEPTION 'Неверное решение'; END IF;
  IF _decision = 'reject' AND (length(coalesce(trim(_comment),'')) < 2) THEN
    RAISE EXCEPTION 'Добавьте комментарий при отклонении';
  END IF;

  UPDATE public.driver_documents
    SET status = CASE _decision WHEN 'approve' THEN 'approved'::driver_doc_status
                                ELSE 'rejected'::driver_doc_status END,
        comment = NULLIF(trim(_comment),''),
        reviewed_at = now(), reviewed_by = auth.uid()
    WHERE id = _doc_id
    RETURNING * INTO v_doc;
  IF NOT FOUND THEN RAISE EXCEPTION 'Документ не найден'; END IF;
  v_driver := v_doc.driver_id;

  -- Notify driver about this doc
  INSERT INTO public.notifications (user_id, title, body, type, data)
    VALUES (v_driver,
      CASE _decision WHEN 'approve' THEN 'Документ одобрен' ELSE 'Документ отклонён' END,
      COALESCE(NULLIF(trim(_comment),''), v_doc.kind::text),
      'driver_doc_' || _decision,
      jsonb_build_object('document_id', v_doc.id, 'kind', v_doc.kind));

  -- Roll up application status
  SELECT count(*) FILTER (WHERE status='approved'),
         count(*) FILTER (WHERE status='rejected'),
         count(*)
    INTO v_approved, v_rejected, v_total
    FROM public.driver_documents WHERE driver_id = v_driver;

  IF v_total >= 4 AND v_approved = 4 THEN
    UPDATE public.drivers
      SET application_status='approved'::driver_app_status,
          verification='approved',
          reviewed_at=now(), reviewed_by=auth.uid(),
          review_comment = NULL
      WHERE id = v_driver;
    INSERT INTO public.notifications (user_id, title, body, type, data)
      VALUES (v_driver,'Заявка водителя одобрена','Доступен раздел водителя','driver_approved',
              jsonb_build_object('driver_id', v_driver));
  ELSIF v_rejected > 0 THEN
    UPDATE public.drivers
      SET application_status='needs_reupload'::driver_app_status,
          verification='pending',
          reviewed_at=now(), reviewed_by=auth.uid()
      WHERE id = v_driver;
  END IF;

  RETURN v_doc;
END $func$;


-- ============================================
-- MIGRATION: 20260630183350_2a17ad28-bcf1-48a7-a4b5-cf099c4347e7.sql
-- ============================================

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


-- ============================================
-- MIGRATION: 20260630190948_c471699c-a724-42e2-bf64-178ac3ffae80.sql
-- ============================================
CREATE OR REPLACE FUNCTION public.submit_driver_application(_first_name text, _last_name text, _patronymic text, _vehicle_plate text, _vehicle_country text, _child_seat boolean, _identity_path text, _identity_mime text, _license_path text, _license_mime text, _vehicle_registration_path text, _vehicle_registration_mime text, _vehicle_documents_path text, _vehicle_documents_mime text)
 RETURNS drivers
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v_profile public.profiles%ROWTYPE; v_drv public.drivers%ROWTYPE;
BEGIN
  SELECT * INTO v_profile FROM public.profiles WHERE id = auth.uid();
  IF v_profile.id IS NULL THEN RAISE EXCEPTION 'Профиль не найден'; END IF;
  IF v_profile.gender IS DISTINCT FROM 'female' THEN
    RAISE EXCEPTION 'Только женщины могут зарегистрироваться в качестве водителя.';
  END IF;
  IF _vehicle_plate IS NULL OR length(trim(_vehicle_plate)) < 2 THEN RAISE EXCEPTION 'Укажите госномер'; END IF;
  IF _vehicle_country IS NULL OR length(trim(_vehicle_country)) < 2 THEN RAISE EXCEPTION 'Укажите страну авто'; END IF;
  IF _child_seat IS NULL THEN RAISE EXCEPTION 'Укажите наличие детского кресла'; END IF;

  INSERT INTO public.drivers (id, first_name, last_name, patronymic, vehicle_plate, vehicle_country, child_seat,
                              application_status, submitted_at, status, verification)
  VALUES (auth.uid(),
    COALESCE(NULLIF(trim(_first_name),''), v_profile.first_name),
    COALESCE(NULLIF(trim(_last_name),''),  v_profile.last_name),
    NULLIF(trim(_patronymic),''),
    trim(_vehicle_plate), trim(_vehicle_country), _child_seat,
    'pending'::driver_app_status, now(), 'offline', 'pending')
  ON CONFLICT (id) DO UPDATE SET
    first_name = EXCLUDED.first_name,
    last_name  = EXCLUDED.last_name,
    patronymic = EXCLUDED.patronymic,
    vehicle_plate = EXCLUDED.vehicle_plate,
    vehicle_country = EXCLUDED.vehicle_country,
    child_seat = EXCLUDED.child_seat,
    application_status = 'pending'::driver_app_status,
    submitted_at = now(),
    review_comment = NULL,
    verification = 'pending'
  RETURNING * INTO v_drv;

  INSERT INTO public.user_roles (user_id, role) VALUES (auth.uid(),'driver') ON CONFLICT DO NOTHING;

  PERFORM public._upsert_driver_doc(auth.uid(),'identity',             _identity_path,             _identity_mime);
  PERFORM public._upsert_driver_doc(auth.uid(),'license',              _license_path,              _license_mime);
  PERFORM public._upsert_driver_doc(auth.uid(),'vehicle_registration', _vehicle_registration_path, _vehicle_registration_mime);
  PERFORM public._upsert_driver_doc(auth.uid(),'vehicle_documents',    _vehicle_documents_path,    _vehicle_documents_mime);

  INSERT INTO public.notifications (user_id, title, body, type, data)
    VALUES (auth.uid(),'Заявка водителя отправлена','Документы переданы на проверку','driver_submitted',
            jsonb_build_object('driver_id', auth.uid()));
  RETURN v_drv;
END $function$;

-- ============================================
-- MIGRATION: 20260630191329_19cddd17-6111-4eff-b289-10c82404b83a.sql
-- ============================================

-- Remove obsolete vehicle_registration docs so the new 3-of-3 rollup is correct
DELETE FROM public.driver_documents WHERE kind = 'vehicle_registration';

-- Simplified submission: no name fields, no vehicle_registration doc.
DROP FUNCTION IF EXISTS public.submit_driver_application(text, text, text, text, text, boolean, text, text, text, text, text, text, text, text);

CREATE OR REPLACE FUNCTION public.submit_driver_application(
  _vehicle_plate text,
  _vehicle_country text,
  _child_seat boolean,
  _identity_path text, _identity_mime text,
  _license_path text, _license_mime text,
  _vehicle_documents_path text, _vehicle_documents_mime text
)
RETURNS public.drivers
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE v_profile public.profiles%ROWTYPE; v_drv public.drivers%ROWTYPE;
BEGIN
  SELECT * INTO v_profile FROM public.profiles WHERE id = auth.uid();
  IF v_profile.id IS NULL THEN RAISE EXCEPTION 'Профиль не найден'; END IF;
  IF v_profile.gender IS DISTINCT FROM 'female' THEN
    RAISE EXCEPTION 'Только женщины могут зарегистрироваться в качестве водителя.';
  END IF;
  IF _vehicle_plate IS NULL OR length(trim(_vehicle_plate)) < 2 THEN RAISE EXCEPTION 'Укажите госномер'; END IF;
  IF _vehicle_country IS NULL OR length(trim(_vehicle_country)) < 2 THEN RAISE EXCEPTION 'Укажите страну авто'; END IF;
  IF _child_seat IS NULL THEN RAISE EXCEPTION 'Укажите наличие детского кресла'; END IF;

  INSERT INTO public.drivers (id, first_name, last_name, patronymic, vehicle_plate, vehicle_country, child_seat,
                              application_status, submitted_at, status, verification)
  VALUES (auth.uid(),
    v_profile.first_name, v_profile.last_name, v_profile.patronymic,
    trim(_vehicle_plate), trim(_vehicle_country), _child_seat,
    'pending'::driver_app_status, now(), 'offline', 'pending')
  ON CONFLICT (id) DO UPDATE SET
    first_name = EXCLUDED.first_name,
    last_name  = EXCLUDED.last_name,
    patronymic = EXCLUDED.patronymic,
    vehicle_plate = EXCLUDED.vehicle_plate,
    vehicle_country = EXCLUDED.vehicle_country,
    child_seat = EXCLUDED.child_seat,
    application_status = 'pending'::driver_app_status,
    submitted_at = now(),
    review_comment = NULL,
    verification = 'pending'
  RETURNING * INTO v_drv;

  INSERT INTO public.user_roles (user_id, role) VALUES (auth.uid(),'driver') ON CONFLICT DO NOTHING;

  PERFORM public._upsert_driver_doc(auth.uid(),'identity',          _identity_path,          _identity_mime);
  PERFORM public._upsert_driver_doc(auth.uid(),'license',           _license_path,           _license_mime);
  PERFORM public._upsert_driver_doc(auth.uid(),'vehicle_documents', _vehicle_documents_path, _vehicle_documents_mime);

  -- Clean up any legacy vehicle_registration doc on resubmit
  DELETE FROM public.driver_documents WHERE driver_id = auth.uid() AND kind = 'vehicle_registration';

  INSERT INTO public.notifications (user_id, title, body, type, data)
    VALUES (auth.uid(),'Заявка водителя отправлена','Документы переданы на проверку','driver_submitted',
            jsonb_build_object('driver_id', auth.uid()));
  RETURN v_drv;
END $function$;

-- Approval rollup now expects 3 documents instead of 4
CREATE OR REPLACE FUNCTION public.admin_review_document(_doc_id uuid, _decision text, _comment text)
 RETURNS driver_documents
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v_doc public.driver_documents%ROWTYPE;
        v_total int; v_approved int; v_rejected int;
        v_driver uuid;
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'Только для администраторов'; END IF;
  IF _decision NOT IN ('approve','reject') THEN RAISE EXCEPTION 'Неверное решение'; END IF;
  IF _decision = 'reject' AND (length(coalesce(trim(_comment),'')) < 2) THEN
    RAISE EXCEPTION 'Добавьте комментарий при отклонении';
  END IF;

  UPDATE public.driver_documents
    SET status = CASE _decision WHEN 'approve' THEN 'approved'::driver_doc_status
                                ELSE 'rejected'::driver_doc_status END,
        comment = NULLIF(trim(_comment),''),
        reviewed_at = now(), reviewed_by = auth.uid()
    WHERE id = _doc_id
    RETURNING * INTO v_doc;
  IF NOT FOUND THEN RAISE EXCEPTION 'Документ не найден'; END IF;
  v_driver := v_doc.driver_id;

  INSERT INTO public.notifications (user_id, title, body, type, data)
    VALUES (v_driver,
      CASE _decision WHEN 'approve' THEN 'Документ одобрен' ELSE 'Документ отклонён' END,
      COALESCE(NULLIF(trim(_comment),''), v_doc.kind::text),
      'driver_doc_' || _decision,
      jsonb_build_object('document_id', v_doc.id, 'kind', v_doc.kind));

  SELECT count(*) FILTER (WHERE status='approved'),
         count(*) FILTER (WHERE status='rejected'),
         count(*)
    INTO v_approved, v_rejected, v_total
    FROM public.driver_documents
    WHERE driver_id = v_driver AND kind IN ('identity','license','vehicle_documents');

  IF v_total >= 3 AND v_approved = 3 THEN
    UPDATE public.drivers
      SET application_status='approved'::driver_app_status,
          verification='approved',
          reviewed_at=now(), reviewed_by=auth.uid(),
          review_comment = NULL
      WHERE id = v_driver;
    INSERT INTO public.notifications (user_id, title, body, type, data)
      VALUES (v_driver,'Заявка водителя одобрена','Доступен раздел водителя','driver_approved',
              jsonb_build_object('driver_id', v_driver));
  ELSIF v_rejected > 0 THEN
    UPDATE public.drivers
      SET application_status='needs_reupload'::driver_app_status,
          verification='pending',
          reviewed_at=now(), reviewed_by=auth.uid()
      WHERE id = v_driver;
  END IF;

  RETURN v_doc;
END $function$;


-- ============================================
-- MIGRATION: 20260630192348_a2be176e-0f3f-4a73-af18-0359b5a79daf.sql
-- ============================================
DO $$ BEGIN
  CREATE TYPE public.ride_tariff AS ENUM ('standard','kids');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.rides
  ADD COLUMN IF NOT EXISTS tariff public.ride_tariff NOT NULL DEFAULT 'standard',
  ADD COLUMN IF NOT EXISTS estimated_fare numeric(10,2);


-- ============================================
-- MIGRATION: 20260630194319_fb39bc1d-3c81-4c5e-b9e6-f1a3e478e9f7.sql
-- ============================================
ALTER TABLE public.rides ADD COLUMN IF NOT EXISTS pickup_wait_seconds integer;

CREATE OR REPLACE FUNCTION public.set_pickup_wait_seconds()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'in_progress' AND OLD.status IS DISTINCT FROM 'in_progress' THEN
    NEW.started_at := COALESCE(NEW.started_at, now());
    IF NEW.pickup_wait_seconds IS NULL AND NEW.requested_at IS NOT NULL THEN
      NEW.pickup_wait_seconds := GREATEST(0, EXTRACT(EPOCH FROM (NEW.started_at - NEW.requested_at))::int);
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_pickup_wait_seconds ON public.rides;
CREATE TRIGGER trg_set_pickup_wait_seconds
  BEFORE UPDATE ON public.rides
  FOR EACH ROW
  EXECUTE FUNCTION public.set_pickup_wait_seconds();

-- ============================================
-- MIGRATION: 20260630195209_916fde54-256b-4a74-ad8f-9b153b633f97.sql
-- ============================================
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TABLE IF NOT EXISTS public.saved_addresses (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  address TEXT NOT NULL,
  lat DOUBLE PRECISION NOT NULL,
  lng DOUBLE PRECISION NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.saved_addresses TO authenticated;
GRANT ALL ON public.saved_addresses TO service_role;
ALTER TABLE public.saved_addresses ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users manage own saved addresses" ON public.saved_addresses;
CREATE POLICY "Users manage own saved addresses" ON public.saved_addresses
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX IF NOT EXISTS idx_saved_addresses_user ON public.saved_addresses(user_id);
DROP TRIGGER IF EXISTS update_saved_addresses_updated_at ON public.saved_addresses;
CREATE TRIGGER update_saved_addresses_updated_at
  BEFORE UPDATE ON public.saved_addresses
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================
-- MIGRATION: 20260630195524_2e0c815e-3d64-4db0-9af7-311d0e3d50b5.sql
-- ============================================
ALTER TYPE public.ride_tariff ADD VALUE IF NOT EXISTS 'delivery';
ALTER TYPE public.ride_tariff ADD VALUE IF NOT EXISTS 'cargo';

-- ============================================
-- MIGRATION: 20260701093000_update_iin_access_rules.sql
-- ============================================
CREATE OR REPLACE FUNCTION public.submit_passenger_verification(
  _full_name text,
  _iin text,
  _dob date,
  _gender text,
  _selfie_path text,
  _ai_confidence numeric,
  _ai_reason text
)
RETURNS verification_requests
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_req verification_requests%ROWTYPE;
  v_status verify_status;
BEGIN
  IF _iin IS NULL OR _iin !~ '^\d{12}$' THEN
    RAISE EXCEPTION 'ИИН должен содержать 12 цифр';
  END IF;
  IF _selfie_path IS NULL OR length(_selfie_path) < 3 THEN
    RAISE EXCEPTION 'Селфи обязательно';
  END IF;
  IF _full_name IS NULL OR length(trim(_full_name)) < 2 THEN
    RAISE EXCEPTION 'Укажите ФИО';
  END IF;
  IF _dob IS NULL THEN
    RAISE EXCEPTION 'Дата рождения обязательна';
  END IF;

  IF _dob <= (CURRENT_DATE - INTERVAL '18 years')::date AND _gender IS DISTINCT FROM 'female' THEN
    RAISE EXCEPTION 'Взрослые мужчины не допускаются к сервису';
  END IF;

  v_status := CASE
    WHEN _ai_confidence IS NOT NULL AND _ai_confidence >= 0.85 THEN 'approved'::verify_status
    ELSE 'rejected'::verify_status
  END;

  INSERT INTO verification_requests (
    user_id,
    kind,
    status,
    full_name,
    iin,
    date_of_birth,
    gender,
    selfie_path,
    ai_confidence,
    ai_reason
  )
  VALUES (
    auth.uid(),
    'passenger',
    v_status,
    _full_name,
    _iin,
    _dob,
    _gender,
    _selfie_path,
    _ai_confidence,
    NULLIF(_ai_reason, '')
  )
  RETURNING * INTO v_req;

  UPDATE profiles
  SET
    full_name = COALESCE(_full_name, full_name),
    iin = _iin,
    date_of_birth = _dob,
    gender = _gender,
    selfie_path = _selfie_path,
    verification_status = v_status
  WHERE id = auth.uid();

  INSERT INTO notifications (user_id, title, body, type, data)
  VALUES (
    auth.uid(),
    CASE WHEN v_status = 'approved' THEN 'Аккаунт подтверждён' ELSE 'Верификация отклонена' END,
    CASE
      WHEN v_status = 'approved' THEN 'Личность успешно подтверждена'
      ELSE COALESCE(NULLIF(_ai_reason, ''), 'Проверьте данные и отправьте верификацию заново')
    END,
    'verification',
    jsonb_build_object('request_id', v_req.id, 'status', v_status)
  );

  RETURN v_req;
END $function$;


CREATE OR REPLACE FUNCTION public.submit_driver_application(
  _vehicle_plate text,
  _vehicle_country text,
  _child_seat boolean,
  _identity_path text,
  _identity_mime text,
  _license_path text,
  _license_mime text,
  _vehicle_documents_path text,
  _vehicle_documents_mime text
)
RETURNS public.drivers
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_profile public.profiles%ROWTYPE;
  v_drv public.drivers%ROWTYPE;
BEGIN
  SELECT * INTO v_profile FROM public.profiles WHERE id = auth.uid();

  IF v_profile.id IS NULL THEN
    RAISE EXCEPTION 'Профиль не найден';
  END IF;
  IF v_profile.verification_status <> 'approved' THEN
    RAISE EXCEPTION 'Сначала пройдите подтверждение личности';
  END IF;
  IF v_profile.gender IS DISTINCT FROM 'female' THEN
    RAISE EXCEPTION 'Водителем может стать только женщина';
  END IF;
  IF v_profile.date_of_birth IS NULL OR v_profile.date_of_birth > (CURRENT_DATE - INTERVAL '18 years')::date THEN
    RAISE EXCEPTION 'Водителю должно быть не менее 18 полных лет';
  END IF;
  IF _vehicle_plate IS NULL OR length(trim(_vehicle_plate)) < 2 THEN
    RAISE EXCEPTION 'Укажите госномер';
  END IF;
  IF _vehicle_country IS NULL OR length(trim(_vehicle_country)) < 2 THEN
    RAISE EXCEPTION 'Укажите страну авто';
  END IF;
  IF _child_seat IS NULL THEN
    RAISE EXCEPTION 'Укажите наличие детского кресла';
  END IF;

  INSERT INTO public.drivers (
    id,
    first_name,
    last_name,
    patronymic,
    vehicle_plate,
    vehicle_country,
    child_seat,
    application_status,
    submitted_at,
    status,
    verification
  )
  VALUES (
    auth.uid(),
    v_profile.first_name,
    v_profile.last_name,
    v_profile.patronymic,
    trim(_vehicle_plate),
    trim(_vehicle_country),
    _child_seat,
    'pending'::driver_app_status,
    now(),
    'offline',
    'pending'
  )
  ON CONFLICT (id) DO UPDATE SET
    first_name = EXCLUDED.first_name,
    last_name = EXCLUDED.last_name,
    patronymic = EXCLUDED.patronymic,
    vehicle_plate = EXCLUDED.vehicle_plate,
    vehicle_country = EXCLUDED.vehicle_country,
    child_seat = EXCLUDED.child_seat,
    application_status = 'pending'::driver_app_status,
    submitted_at = now(),
    review_comment = NULL,
    verification = 'pending'
  RETURNING * INTO v_drv;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (auth.uid(), 'driver')
  ON CONFLICT DO NOTHING;

  PERFORM public._upsert_driver_doc(auth.uid(), 'identity', _identity_path, _identity_mime);
  PERFORM public._upsert_driver_doc(auth.uid(), 'license', _license_path, _license_mime);
  PERFORM public._upsert_driver_doc(auth.uid(), 'vehicle_documents', _vehicle_documents_path, _vehicle_documents_mime);

  DELETE FROM public.driver_documents
  WHERE driver_id = auth.uid() AND kind = 'vehicle_registration';

  INSERT INTO public.notifications (user_id, title, body, type, data)
  VALUES (
    auth.uid(),
    'Заявка водителя отправлена',
    'Документы переданы на проверку',
    'driver_submitted',
    jsonb_build_object('driver_id', auth.uid())
  );

  RETURN v_drv;
END $function$;


-- ============================================
-- MIGRATION: 20260701110000_child_tariff_pin_flow.sql
-- ============================================
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


-- ============================================
-- MIGRATION: 20260701123000_passenger_children_iin_limits.sql
-- ============================================
ALTER TABLE public.passenger_children
  ADD COLUMN IF NOT EXISTS iin text;

UPDATE public.passenger_children
SET iin = COALESCE(iin, lpad(((random() * 100000000000)::bigint % 100000000000)::text, 12, '0'))
WHERE iin IS NULL;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'passenger_children'
      AND column_name = 'iin'
      AND is_nullable = 'YES'
  ) THEN
    ALTER TABLE public.passenger_children
      ALTER COLUMN iin SET NOT NULL;
  END IF;
END $$;

ALTER TABLE public.passenger_children
  DROP CONSTRAINT IF EXISTS passenger_children_iin_format_chk;

ALTER TABLE public.passenger_children
  ADD CONSTRAINT passenger_children_iin_format_chk
  CHECK (iin ~ '^\d{12}$');

CREATE UNIQUE INDEX IF NOT EXISTS idx_passenger_children_mother_iin
  ON public.passenger_children (mother_id, iin);

CREATE OR REPLACE FUNCTION public.validate_passenger_child()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_age int;
  v_count int;
  v_sum int;
  v_checksum int;
  v_gender_digit int;
  v_year int;
  v_month int;
  v_day int;
  v_century int;
  v_dob date;
  w1 int[] := ARRAY[1,2,3,4,5,6,7,8,9,10,11];
  w2 int[] := ARRAY[3,4,5,6,7,8,9,10,11,1,2];
BEGIN
  IF NOT public.is_adult_female_profile(NEW.mother_id) THEN
    RAISE EXCEPTION 'Добавлять детей могут только совершеннолетние женщины-пассажирки';
  END IF;

  NEW.full_name := btrim(NEW.full_name);
  NEW.iin := btrim(NEW.iin);

  IF NEW.full_name = '' THEN
    RAISE EXCEPTION 'Укажите ФИО ребёнка';
  END IF;

  IF NEW.iin !~ '^\d{12}$' THEN
    RAISE EXCEPTION 'ИИН ребёнка должен содержать 12 цифр';
  END IF;

  v_gender_digit := substr(NEW.iin, 7, 1)::int;
  IF v_gender_digit < 1 OR v_gender_digit > 6 THEN
    RAISE EXCEPTION 'ИИН ребёнка некорректен';
  END IF;

  v_sum := 0;
  FOR i IN 1..11 LOOP
    v_sum := v_sum + substr(NEW.iin, i, 1)::int * w1[i];
  END LOOP;
  v_checksum := v_sum % 11;

  IF v_checksum = 10 THEN
    v_sum := 0;
    FOR i IN 1..11 LOOP
      v_sum := v_sum + substr(NEW.iin, i, 1)::int * w2[i];
    END LOOP;
    v_checksum := v_sum % 11;
  END IF;

  IF v_checksum = 10 OR v_checksum <> substr(NEW.iin, 12, 1)::int THEN
    RAISE EXCEPTION 'ИИН ребёнка не прошёл проверку';
  END IF;

  v_century := CASE
    WHEN v_gender_digit IN (1, 2) THEN 1800
    WHEN v_gender_digit IN (3, 4) THEN 1900
    ELSE 2000
  END;
  v_year := v_century + substr(NEW.iin, 1, 2)::int;
  v_month := substr(NEW.iin, 3, 2)::int;
  v_day := substr(NEW.iin, 5, 2)::int;

  BEGIN
    v_dob := make_date(v_year, v_month, v_day);
  EXCEPTION
    WHEN OTHERS THEN
      RAISE EXCEPTION 'Дата рождения в ИИН ребёнка некорректна';
  END;

  IF v_dob > current_date THEN
    RAISE EXCEPTION 'Дата рождения ребёнка не может быть в будущем';
  END IF;

  v_age := public.get_age_years(v_dob);
  IF v_age < 0 OR v_age >= 12 THEN
    RAISE EXCEPTION 'Можно добавлять только детей младше 12 лет';
  END IF;

  NEW.birth_date := v_dob;

  SELECT count(*)
  INTO v_count
  FROM public.passenger_children
  WHERE mother_id = NEW.mother_id
    AND (TG_OP = 'INSERT' OR id <> NEW.id);

  IF TG_OP = 'INSERT' AND v_count >= 5 THEN
    RAISE EXCEPTION 'Можно добавить максимум 5 детей';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.passenger_children
    WHERE mother_id = NEW.mother_id
      AND iin = NEW.iin
      AND (TG_OP = 'INSERT' OR id <> NEW.id)
  ) THEN
    RAISE EXCEPTION 'Этот ребёнок уже добавлен';
  END IF;

  RETURN NEW;
END
$$;


-- ============================================
-- MIGRATION: 20260701130000_child_dropoff_guardian_flow.sql
-- ============================================
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


-- ============================================
-- MIGRATION: 20260701134500_child_seat_tariff_access.sql
-- ============================================
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


-- ============================================
-- MIGRATION: 20260701143000_require_verified_identity_for_ride_creation.sql
-- ============================================
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

  IF v_status <> 'approved' THEN
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


-- ============================================
-- MIGRATION: 20260701150000_driver_child_seat_details.sql
-- ============================================
ALTER TABLE public.drivers
  ADD COLUMN IF NOT EXISTS child_seat_details text;

CREATE OR REPLACE FUNCTION public.submit_driver_application(
  _vehicle_plate text,
  _vehicle_country text,
  _child_seat boolean,
  _child_seat_details text,
  _identity_path text,
  _identity_mime text,
  _license_path text,
  _license_mime text,
  _vehicle_documents_path text,
  _vehicle_documents_mime text
)
RETURNS public.drivers
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_profile public.profiles%ROWTYPE;
  v_drv public.drivers%ROWTYPE;
  v_child_seat_details text := NULLIF(btrim(_child_seat_details), '');
BEGIN
  SELECT * INTO v_profile FROM public.profiles WHERE id = auth.uid();

  IF v_profile.id IS NULL THEN
    RAISE EXCEPTION 'Профиль не найден';
  END IF;
  IF v_profile.verification_status <> 'approved' THEN
    RAISE EXCEPTION 'Сначала пройдите подтверждение личности';
  END IF;
  IF v_profile.gender IS DISTINCT FROM 'female' THEN
    RAISE EXCEPTION 'Водителем может стать только женщина';
  END IF;
  IF v_profile.date_of_birth IS NULL OR v_profile.date_of_birth > (CURRENT_DATE - INTERVAL '18 years')::date THEN
    RAISE EXCEPTION 'Водителю должно быть не менее 18 полных лет';
  END IF;
  IF _vehicle_plate IS NULL OR length(trim(_vehicle_plate)) < 2 THEN
    RAISE EXCEPTION 'Укажите госномер';
  END IF;
  IF _vehicle_country IS NULL OR length(trim(_vehicle_country)) < 2 THEN
    RAISE EXCEPTION 'Укажите страну авто';
  END IF;
  IF _child_seat IS NULL THEN
    RAISE EXCEPTION 'Укажите наличие детского кресла';
  END IF;
  IF _child_seat AND v_child_seat_details IS NULL THEN
    RAISE EXCEPTION 'Укажите группу или возраст детей для детского кресла';
  END IF;

  INSERT INTO public.drivers (
    id,
    first_name,
    last_name,
    patronymic,
    vehicle_plate,
    vehicle_country,
    child_seat,
    child_seat_details,
    application_status,
    submitted_at,
    status,
    verification
  )
  VALUES (
    auth.uid(),
    v_profile.first_name,
    v_profile.last_name,
    v_profile.patronymic,
    trim(_vehicle_plate),
    trim(_vehicle_country),
    _child_seat,
    CASE WHEN _child_seat THEN v_child_seat_details ELSE NULL END,
    'pending'::driver_app_status,
    now(),
    'offline',
    'pending'
  )
  ON CONFLICT (id) DO UPDATE SET
    first_name = EXCLUDED.first_name,
    last_name = EXCLUDED.last_name,
    patronymic = EXCLUDED.patronymic,
    vehicle_plate = EXCLUDED.vehicle_plate,
    vehicle_country = EXCLUDED.vehicle_country,
    child_seat = EXCLUDED.child_seat,
    child_seat_details = EXCLUDED.child_seat_details,
    application_status = 'pending'::driver_app_status,
    submitted_at = now(),
    review_comment = NULL,
    verification = 'pending'
  RETURNING * INTO v_drv;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (auth.uid(), 'driver')
  ON CONFLICT DO NOTHING;

  PERFORM public._upsert_driver_doc(auth.uid(), 'identity', _identity_path, _identity_mime);
  PERFORM public._upsert_driver_doc(auth.uid(), 'license', _license_path, _license_mime);
  PERFORM public._upsert_driver_doc(auth.uid(), 'vehicle_documents', _vehicle_documents_path, _vehicle_documents_mime);

  DELETE FROM public.driver_documents
  WHERE driver_id = auth.uid() AND kind = 'vehicle_registration';

  INSERT INTO public.notifications (user_id, title, body, type, data)
  VALUES (
    auth.uid(),
    'Заявка водителя отправлена',
    'Документы переданы на проверку',
    'driver_submitted',
    jsonb_build_object('driver_id', auth.uid())
  );

  RETURN v_drv;
END $function$;
