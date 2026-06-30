
-- Remove obsolete vehicle_registration docs so the new 3-of-3 rollup is correct
DELETE FROM public.driver_documents WHERE kind = 'vehicle_registration';

-- Simplified submission: no name fields, no vehicle_registration doc.
DROP FUNCTION IF EXISTS public.submit_driver_application(text, text, text, text, text, boolean, text, text, text, text, text, text, text, text);

CREATE OR REPLACE FUNCTION public.submit_driver_application(
  _vehicle_plate text,
  _vehicle_country text,
  _child_seat boolean,
  _identity_path text, _identity_mime text,
  _license_path text, _license_mime text,
  _vehicle_documents_path text, _vehicle_documents_mime text
)
RETURNS public.drivers
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
    v_profile.first_name, v_profile.last_name, v_profile.patronymic,
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

  PERFORM public._upsert_driver_doc(auth.uid(),'identity',          _identity_path,          _identity_mime);
  PERFORM public._upsert_driver_doc(auth.uid(),'license',           _license_path,           _license_mime);
  PERFORM public._upsert_driver_doc(auth.uid(),'vehicle_documents', _vehicle_documents_path, _vehicle_documents_mime);

  -- Clean up any legacy vehicle_registration doc on resubmit
  DELETE FROM public.driver_documents WHERE driver_id = auth.uid() AND kind = 'vehicle_registration';

  INSERT INTO public.notifications (user_id, title, body, type, data)
    VALUES (auth.uid(),'Заявка водителя отправлена','Документы переданы на проверку','driver_submitted',
            jsonb_build_object('driver_id', auth.uid()));
  RETURN v_drv;
END $function$;

-- Approval rollup now expects 3 documents instead of 4
CREATE OR REPLACE FUNCTION public.admin_review_document(_doc_id uuid, _decision text, _comment text)
 RETURNS driver_documents
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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

  INSERT INTO public.notifications (user_id, title, body, type, data)
    VALUES (v_driver,
      CASE _decision WHEN 'approve' THEN 'Документ одобрен' ELSE 'Документ отклонён' END,
      COALESCE(NULLIF(trim(_comment),''), v_doc.kind::text),
      'driver_doc_' || _decision,
      jsonb_build_object('document_id', v_doc.id, 'kind', v_doc.kind));

  SELECT count(*) FILTER (WHERE status='approved'),
         count(*) FILTER (WHERE status='rejected'),
         count(*)
    INTO v_approved, v_rejected, v_total
    FROM public.driver_documents
    WHERE driver_id = v_driver AND kind IN ('identity','license','vehicle_documents');

  IF v_total >= 3 AND v_approved = 3 THEN
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
END $function$;
