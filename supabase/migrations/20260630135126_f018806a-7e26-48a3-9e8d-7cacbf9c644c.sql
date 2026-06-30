CREATE OR REPLACE FUNCTION public.topup_wallet(_amount numeric, _card_last4 text)
RETURNS public.transactions
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_tx public.transactions%ROWTYPE;
BEGIN
  IF _amount <= 0 THEN RAISE EXCEPTION 'Сумма должна быть больше 0'; END IF;
  IF _amount > 1000000 THEN RAISE EXCEPTION 'Слишком большая сумма'; END IF;
  IF _card_last4 IS NULL OR _card_last4 !~ '^\d{4}$' THEN RAISE EXCEPTION 'Введите 4 цифры карты'; END IF;

  UPDATE public.wallets SET balance = balance + _amount, updated_at = now() WHERE user_id = auth.uid();
  IF NOT FOUND THEN
    INSERT INTO public.wallets (user_id, balance) VALUES (auth.uid(), _amount);
  END IF;

  INSERT INTO public.transactions (user_id, type, status, amount, description, metadata)
    VALUES (auth.uid(), 'topup', 'completed', _amount, 'Пополнение картой ****' || _card_last4, jsonb_build_object('card_last4', _card_last4, 'demo', true))
    RETURNING * INTO v_tx;

  INSERT INTO public.notifications (user_id, title, body, type, data)
    VALUES (auth.uid(), 'Кошелёк пополнен', 'Зачислено ' || _amount::text || ' ₸', 'wallet_topup', jsonb_build_object('amount', _amount));

  RETURN v_tx;
END $$;