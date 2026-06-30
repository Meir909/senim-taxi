
CREATE TYPE public.app_role AS ENUM ('passenger','driver','admin');
CREATE TYPE public.driver_status AS ENUM ('offline','online','on_ride');
CREATE TYPE public.driver_verification AS ENUM ('pending','approved','rejected');
CREATE TYPE public.ride_status AS ENUM ('requested','searching','accepted','driver_arriving','driver_arrived','in_progress','completed','cancelled','no_drivers');
CREATE TYPE public.ride_offer_status AS ENUM ('pending','accepted','rejected','timeout','cancelled');
CREATE TYPE public.payment_method AS ENUM ('cash','wallet','card_demo');
CREATE TYPE public.tx_type AS ENUM ('ride_earning','commission','withdrawal','topup','refund','adjustment');
CREATE TYPE public.tx_status AS ENUM ('pending','completed','failed','cancelled');
CREATE TYPE public.withdrawal_status AS ENUM ('pending','approved','rejected','paid');

CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT, phone TEXT, avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "profiles_select_any_authenticated" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "profiles_update_own" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
CREATE POLICY "profiles_insert_own" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);

CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "user_roles_select_own" ON public.user_roles FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE TABLE public.drivers (
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
CREATE POLICY "drivers_select_for_authenticated" ON public.drivers FOR SELECT TO authenticated USING (true);
CREATE POLICY "drivers_update_self" ON public.drivers FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
CREATE POLICY "drivers_insert_self" ON public.drivers FOR INSERT TO authenticated WITH CHECK (auth.uid() = id AND public.has_role(auth.uid(),'driver'));

CREATE TABLE public.driver_locations (
  driver_id UUID PRIMARY KEY REFERENCES public.drivers(id) ON DELETE CASCADE,
  lat DOUBLE PRECISION NOT NULL, lng DOUBLE PRECISION NOT NULL,
  heading DOUBLE PRECISION, speed DOUBLE PRECISION, accuracy DOUBLE PRECISION,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.driver_locations TO authenticated;
GRANT ALL ON public.driver_locations TO service_role;
ALTER TABLE public.driver_locations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "driver_locations_self_write" ON public.driver_locations FOR ALL TO authenticated USING (auth.uid() = driver_id) WITH CHECK (auth.uid() = driver_id);
CREATE POLICY "driver_locations_read_authenticated" ON public.driver_locations FOR SELECT TO authenticated USING (true);
CREATE INDEX idx_driver_locations_lat_lng ON public.driver_locations (lat, lng);

CREATE TABLE public.rides (
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
CREATE POLICY "rides_passenger_select" ON public.rides FOR SELECT TO authenticated USING (auth.uid() = passenger_id);
CREATE POLICY "rides_driver_select" ON public.rides FOR SELECT TO authenticated USING (auth.uid() = driver_id);
CREATE POLICY "rides_passenger_insert" ON public.rides FOR INSERT TO authenticated WITH CHECK (auth.uid() = passenger_id);
CREATE POLICY "rides_passenger_update" ON public.rides FOR UPDATE TO authenticated USING (auth.uid() = passenger_id) WITH CHECK (auth.uid() = passenger_id);
CREATE POLICY "rides_driver_update" ON public.rides FOR UPDATE TO authenticated USING (auth.uid() = driver_id) WITH CHECK (auth.uid() = driver_id);
CREATE INDEX idx_rides_status ON public.rides (status);
CREATE INDEX idx_rides_passenger ON public.rides (passenger_id, requested_at DESC);
CREATE INDEX idx_rides_driver ON public.rides (driver_id, requested_at DESC);

CREATE TABLE public.ride_offers (
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
CREATE POLICY "ride_offers_driver_select" ON public.ride_offers FOR SELECT TO authenticated USING (auth.uid() = driver_id);
CREATE POLICY "ride_offers_passenger_select" ON public.ride_offers FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.rides r WHERE r.id = ride_id AND r.passenger_id = auth.uid()));
CREATE INDEX idx_ride_offers_driver_status ON public.ride_offers (driver_id, status);
CREATE INDEX idx_ride_offers_ride ON public.ride_offers (ride_id);

CREATE TABLE public.wallets (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  balance NUMERIC(12,2) NOT NULL DEFAULT 0,
  pending_balance NUMERIC(12,2) NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'USD',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.wallets TO authenticated;
GRANT ALL ON public.wallets TO service_role;
ALTER TABLE public.wallets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "wallets_select_own" ON public.wallets FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE TABLE public.transactions (
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
CREATE POLICY "transactions_select_own" ON public.transactions FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE INDEX idx_tx_user ON public.transactions (user_id, created_at DESC);

CREATE TABLE public.withdrawals (
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
CREATE POLICY "withdrawals_select_own" ON public.withdrawals FOR SELECT TO authenticated USING (auth.uid() = driver_id);
CREATE POLICY "withdrawals_insert_own" ON public.withdrawals FOR INSERT TO authenticated WITH CHECK (auth.uid() = driver_id AND public.has_role(auth.uid(),'driver'));

CREATE TABLE public.notifications (
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
CREATE POLICY "notifications_select_own" ON public.notifications FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "notifications_update_own" ON public.notifications FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX idx_notifications_user ON public.notifications (user_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.tg_set_updated_at() RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;
CREATE TRIGGER trg_profiles_updated BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
CREATE TRIGGER trg_drivers_updated BEFORE UPDATE ON public.drivers FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
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
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- haversine, fixed: filter distance in outer query
CREATE OR REPLACE FUNCTION public.find_nearby_drivers(_lat DOUBLE PRECISION, _lng DOUBLE PRECISION, _radius_km DOUBLE PRECISION DEFAULT 3)
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
      AND dl.updated_at > now() - interval '60 seconds'
  ) x
  WHERE x.distance_km <= _radius_km
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

ALTER PUBLICATION supabase_realtime ADD TABLE public.rides;
ALTER PUBLICATION supabase_realtime ADD TABLE public.ride_offers;
ALTER PUBLICATION supabase_realtime ADD TABLE public.driver_locations;
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
ALTER TABLE public.rides REPLICA IDENTITY FULL;
ALTER TABLE public.ride_offers REPLICA IDENTITY FULL;
ALTER TABLE public.driver_locations REPLICA IDENTITY FULL;
