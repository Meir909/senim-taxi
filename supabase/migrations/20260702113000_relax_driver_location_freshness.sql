CREATE OR REPLACE FUNCTION public.find_nearby_drivers(
  _lat DOUBLE PRECISION,
  _lng DOUBLE PRECISION,
  _radius_km DOUBLE PRECISION DEFAULT 0
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
      d.id AS driver_id,
      dl.lat,
      dl.lng,
      CASE
        WHEN dl.lat IS NULL OR dl.lng IS NULL THEN 999999::double precision
        ELSE (
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
        )::double precision
      END AS distance_km
    FROM public.drivers d
    LEFT JOIN public.driver_locations dl ON dl.driver_id = d.id
    WHERE d.status = 'online'
      AND d.verification = 'approved'
  ) x
  WHERE _radius_km IS NULL OR _radius_km <= 0 OR x.distance_km <= _radius_km
  ORDER BY x.distance_km ASC
$$;
