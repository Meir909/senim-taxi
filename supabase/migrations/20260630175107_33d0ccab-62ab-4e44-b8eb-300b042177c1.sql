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