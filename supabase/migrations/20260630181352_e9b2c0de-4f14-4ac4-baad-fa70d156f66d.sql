
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
