ALTER TABLE public.passenger_children
  ADD COLUMN IF NOT EXISTS iin text;

UPDATE public.passenger_children
SET iin = COALESCE(iin, lpad(((random() * 100000000000)::bigint % 100000000000)::text, 12, '0'))
WHERE iin IS NULL;

ALTER TABLE public.passenger_children
  ALTER COLUMN iin SET NOT NULL;

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
