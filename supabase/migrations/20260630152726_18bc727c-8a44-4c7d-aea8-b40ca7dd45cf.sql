
CREATE OR REPLACE FUNCTION public.submit_passenger_verification(
  _full_name TEXT, _iin TEXT, _dob DATE, _gender TEXT,
  _selfie_path TEXT, _ai_confidence NUMERIC, _ai_reason TEXT
) RETURNS verification_requests
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_req verification_requests%ROWTYPE; v_status verify_status;
BEGIN
  IF _iin IS NULL OR _iin !~ '^\d{12}$' THEN RAISE EXCEPTION 'ИИН должен содержать 12 цифр'; END IF;
  IF _selfie_path IS NULL OR length(_selfie_path) < 3 THEN RAISE EXCEPTION 'Селфи обязательно'; END IF;
  IF _full_name IS NULL OR length(trim(_full_name)) < 2 THEN RAISE EXCEPTION 'Укажите ФИО'; END IF;

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
END $$;

CREATE OR REPLACE FUNCTION public.submit_driver_verification(
  _selfie_path TEXT, _license_path TEXT, _vehicle_doc_path TEXT,
  _ai_confidence NUMERIC, _ai_reason TEXT
) RETURNS verification_requests
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_req verification_requests%ROWTYPE; v_profile profiles%ROWTYPE;
BEGIN
  IF _selfie_path IS NULL THEN RAISE EXCEPTION 'Селфи обязательно'; END IF;
  IF _license_path IS NULL THEN RAISE EXCEPTION 'Фото ВУ обязательно'; END IF;

  SELECT * INTO v_profile FROM profiles WHERE id = auth.uid();
  IF v_profile.iin IS NULL THEN RAISE EXCEPTION 'Сначала подтвердите личность как пассажир (ИИН + селфи)'; END IF;

  INSERT INTO verification_requests (user_id, kind, status, full_name, iin, date_of_birth, gender,
    selfie_path, license_photo_path, vehicle_doc_path, ai_confidence, ai_reason)
  VALUES (auth.uid(), 'driver', 'manual_review', v_profile.full_name, v_profile.iin, v_profile.date_of_birth,
    v_profile.gender, _selfie_path, _license_path, NULLIF(_vehicle_doc_path, ''),
    _ai_confidence, NULLIF(_ai_reason, ''))
  RETURNING * INTO v_req;

  UPDATE drivers SET
    selfie_path = _selfie_path,
    license_photo_path = _license_path,
    vehicle_doc_path = NULLIF(_vehicle_doc_path, ''),
    verification = 'pending'
  WHERE id = auth.uid();

  RETURN v_req;
END $$;

CREATE OR REPLACE FUNCTION public.admin_review_verification(
  _request_id UUID, _decision TEXT, _comment TEXT
) RETURNS verification_requests
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_req verification_requests%ROWTYPE; v_new verify_status;
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'Только для администраторов'; END IF;
  IF _decision NOT IN ('approve','reject','reupload') THEN RAISE EXCEPTION 'Неверное решение'; END IF;

  v_new := CASE _decision
    WHEN 'approve'  THEN 'approved'::verify_status
    WHEN 'reject'   THEN 'rejected'::verify_status
    WHEN 'reupload' THEN 'reupload_requested'::verify_status
  END;

  UPDATE verification_requests SET
    status = v_new,
    reviewer_id = auth.uid(),
    reviewer_comment = NULLIF(_comment, ''),
    reviewed_at = now()
  WHERE id = _request_id RETURNING * INTO v_req;
  IF NOT FOUND THEN RAISE EXCEPTION 'Заявка не найдена'; END IF;

  IF v_req.kind = 'passenger' THEN
    UPDATE profiles SET verification_status = v_new WHERE id = v_req.user_id;
  ELSE
    UPDATE drivers SET
      verification = CASE _decision WHEN 'approve' THEN 'approved'::driver_verification
                                    WHEN 'reject' THEN 'rejected'::driver_verification
                                    ELSE 'pending'::driver_verification END,
      admin_comment = NULLIF(_comment, '')
    WHERE id = v_req.user_id;
  END IF;

  INSERT INTO notifications (user_id, title, body, type, data)
    VALUES (v_req.user_id,
      CASE _decision WHEN 'approve' THEN 'Верификация одобрена'
                     WHEN 'reject'  THEN 'Верификация отклонена'
                     ELSE 'Требуется перезагрузка документов' END,
      COALESCE(NULLIF(_comment, ''), ''), 'verification',
      jsonb_build_object('request_id', v_req.id, 'status', v_new));

  RETURN v_req;
END $$;
