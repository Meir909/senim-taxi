CREATE OR REPLACE FUNCTION public.find_nearby_drivers(
  _lat DOUBLE PRECISION,
  _lng DOUBLE PRECISION,
  _radius_km DOUBLE PRECISION DEFAULT 3
)
RETURNS TABLE (
  driver_id UUID,
  lat DOUBLE PRECISION,
  lng DOUBLE PRECISION,
  distance_km DOUBLE PRECISION
)
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT *
  FROM (
    SELECT
      dl.driver_id,
      dl.lat,
      dl.lng,
      (
        6371 * acos(
          LEAST(
            1.0,
            GREATEST(
              -1.0,
              cos(radians(_lat)) * cos(radians(dl.lat)) * cos(radians(dl.lng) - radians(_lng))
              + sin(radians(_lat)) * sin(radians(dl.lat))
            )
          )
        )
      )::double precision AS distance_km
    FROM public.driver_locations dl
    JOIN public.drivers d ON d.id = dl.driver_id
    WHERE d.status = 'online'
      AND d.verification = 'approved'
      AND dl.updated_at > now() - interval '10 minutes'
  ) x
  WHERE x.distance_km <= _radius_km
  ORDER BY x.distance_km ASC
$$;
