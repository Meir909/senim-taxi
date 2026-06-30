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