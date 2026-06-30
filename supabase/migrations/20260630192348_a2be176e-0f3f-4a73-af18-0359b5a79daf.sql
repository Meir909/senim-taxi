CREATE TYPE public.ride_tariff AS ENUM ('standard','kids');

ALTER TABLE public.rides
  ADD COLUMN tariff public.ride_tariff NOT NULL DEFAULT 'standard',
  ADD COLUMN estimated_fare numeric(10,2);
