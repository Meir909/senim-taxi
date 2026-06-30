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
    WHEN _ai_confidence IS NOT NULL AND _ai_confidence >= 0.85 THEN 'auto_approved'::verify_status
    ELSE 'manual_review'::verify_status
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
    CASE WHEN v_status = 'auto_approved' THEN 'Аккаунт подтверждён' ELSE 'Заявка на проверке' END,
    CASE WHEN v_status = 'auto_approved' THEN 'Личность успешно подтверждена' ELSE 'Ожидайте решения администратора' END,
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
