UPDATE public.profiles
SET verification_status = CASE
  WHEN verification_status IN ('approved', 'auto_approved') THEN 'approved'::public.verify_status
  ELSE 'rejected'::public.verify_status
END
WHERE verification_status IS DISTINCT FROM CASE
  WHEN verification_status IN ('approved', 'auto_approved') THEN 'approved'::public.verify_status
  ELSE 'rejected'::public.verify_status
END;

UPDATE public.verification_requests
SET status = CASE
  WHEN status IN ('approved', 'auto_approved') THEN 'approved'::public.verify_status
  ELSE 'rejected'::public.verify_status
END
WHERE kind = 'passenger'
  AND status IS DISTINCT FROM CASE
    WHEN status IN ('approved', 'auto_approved') THEN 'approved'::public.verify_status
    ELSE 'rejected'::public.verify_status
  END;

CREATE OR REPLACE FUNCTION public.submit_passenger_verification(
  _full_name text,
  _iin text,
  _dob date,
  _gender text,
  _selfie_path text,
  _ai_confidence numeric,
  _ai_reason text
)
RETURNS public.verification_requests
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_req public.verification_requests%ROWTYPE;
  v_status public.verify_status;
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
    WHEN _ai_confidence IS NOT NULL AND _ai_confidence >= 0.85 THEN 'approved'::public.verify_status
    ELSE 'rejected'::public.verify_status
  END;

  INSERT INTO public.verification_requests (
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

  UPDATE public.profiles
  SET
    full_name = COALESCE(_full_name, full_name),
    iin = _iin,
    date_of_birth = _dob,
    gender = _gender,
    selfie_path = _selfie_path,
    verification_status = v_status
  WHERE id = auth.uid();

  INSERT INTO public.notifications (user_id, title, body, type, data)
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

CREATE OR REPLACE FUNCTION public.admin_review_verification(
  _request_id uuid,
  _decision text,
  _comment text
)
RETURNS public.verification_requests
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_req public.verification_requests%ROWTYPE;
  v_new public.verify_status;
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN
    RAISE EXCEPTION 'Только для администраторов';
  END IF;
  IF _decision NOT IN ('approve','reject') THEN
    RAISE EXCEPTION 'Неверное решение';
  END IF;

  v_new := CASE _decision
    WHEN 'approve' THEN 'approved'::public.verify_status
    ELSE 'rejected'::public.verify_status
  END;

  UPDATE public.verification_requests
  SET
    status = v_new,
    reviewer_id = auth.uid(),
    reviewer_comment = NULLIF(_comment, ''),
    reviewed_at = now()
  WHERE id = _request_id
  RETURNING * INTO v_req;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Заявка не найдена';
  END IF;

  IF v_req.kind = 'passenger' THEN
    UPDATE public.profiles
    SET verification_status = v_new
    WHERE id = v_req.user_id;
  ELSE
    UPDATE public.drivers
    SET
      verification = CASE
        WHEN _decision = 'approve' THEN 'approved'::public.driver_verification
        ELSE 'rejected'::public.driver_verification
      END,
      admin_comment = NULLIF(_comment, '')
    WHERE id = v_req.user_id;
  END IF;

  INSERT INTO public.notifications (user_id, title, body, type, data)
  VALUES (
    v_req.user_id,
    CASE WHEN _decision = 'approve' THEN 'Верификация одобрена' ELSE 'Верификация отклонена' END,
    COALESCE(NULLIF(_comment, ''), ''),
    'verification',
    jsonb_build_object('request_id', v_req.id, 'status', v_new)
  );

  RETURN v_req;
END $function$;
