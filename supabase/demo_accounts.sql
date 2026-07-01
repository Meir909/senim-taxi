-- Demo accounts for Senim Taxi
-- Run this in Supabase SQL Editor after the main schema is applied.
--
-- Credentials:
-- 1. driver1@senim.demo / Demo12345!
-- 2. driver2@senim.demo / Demo12345!
-- 3. driver3@senim.demo / Demo12345!
-- 4. passenger.adult@senim.demo / Demo12345!
-- 5. passenger.girl@senim.demo / Demo12345!
-- 6. passenger.boy@senim.demo / Demo12345!

DO $$
DECLARE
  v_now timestamptz := now();
BEGIN
  -- Make sure password hashing is available.
  CREATE EXTENSION IF NOT EXISTS pgcrypto;

  -- 1) Auth users
  INSERT INTO auth.users (
    id,
    instance_id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    invited_at,
    confirmation_sent_at,
    recovery_sent_at,
    email_change_sent_at,
    last_sign_in_at,
    raw_app_meta_data,
    raw_user_meta_data,
    is_super_admin,
    created_at,
    updated_at,
    phone,
    phone_confirmed_at,
    confirmation_token,
    email_change,
    email_change_token_new,
    recovery_token
  )
  VALUES
    (
      '11111111-1111-4111-8111-111111111111',
      '00000000-0000-0000-0000-000000000000',
      'authenticated',
      'authenticated',
      'driver1@senim.demo',
      crypt('Demo12345!', gen_salt('bf')),
      v_now, NULL, NULL, NULL, NULL, v_now,
      '{"provider":"email","providers":["email"]}'::jsonb,
      '{"full_name":"Айжан Серикова","first_name":"Айжан","last_name":"Серикова","phone":"+77010000001","iin":"900715400011","date_of_birth":"1990-07-15","gender":"female"}'::jsonb,
      false, v_now, v_now, '+77010000001', v_now, '', '', '', ''
    ),
    (
      '22222222-2222-4222-8222-222222222222',
      '00000000-0000-0000-0000-000000000000',
      'authenticated',
      'authenticated',
      'driver2@senim.demo',
      crypt('Demo12345!', gen_salt('bf')),
      v_now, NULL, NULL, NULL, NULL, v_now,
      '{"provider":"email","providers":["email"]}'::jsonb,
      '{"full_name":"Мадина Нурланкызы","first_name":"Мадина","last_name":"Нурланкызы","phone":"+77010000002","iin":"920320400018","date_of_birth":"1992-03-20","gender":"female"}'::jsonb,
      false, v_now, v_now, '+77010000002', v_now, '', '', '', ''
    ),
    (
      '33333333-3333-4333-8333-333333333333',
      '00000000-0000-0000-0000-000000000000',
      'authenticated',
      'authenticated',
      'driver3@senim.demo',
      crypt('Demo12345!', gen_salt('bf')),
      v_now, NULL, NULL, NULL, NULL, v_now,
      '{"provider":"email","providers":["email"]}'::jsonb,
      '{"full_name":"Динара Бекетова","first_name":"Динара","last_name":"Бекетова","phone":"+77010000003","iin":"880911400010","date_of_birth":"1988-09-11","gender":"female"}'::jsonb,
      false, v_now, v_now, '+77010000003', v_now, '', '', '', ''
    ),
    (
      '44444444-4444-4444-8444-444444444444',
      '00000000-0000-0000-0000-000000000000',
      'authenticated',
      'authenticated',
      'passenger.adult@senim.demo',
      crypt('Demo12345!', gen_salt('bf')),
      v_now, NULL, NULL, NULL, NULL, v_now,
      '{"provider":"email","providers":["email"]}'::jsonb,
      '{"full_name":"Асель Тлеубаева","first_name":"Асель","last_name":"Тлеубаева","phone":"+77010000004","iin":"950601400010","date_of_birth":"1995-06-01","gender":"female"}'::jsonb,
      false, v_now, v_now, '+77010000004', v_now, '', '', '', ''
    ),
    (
      '55555555-5555-4555-8555-555555555555',
      '00000000-0000-0000-0000-000000000000',
      'authenticated',
      'authenticated',
      'passenger.girl@senim.demo',
      crypt('Demo12345!', gen_salt('bf')),
      v_now, NULL, NULL, NULL, NULL, v_now,
      '{"provider":"email","providers":["email"]}'::jsonb,
      '{"full_name":"Аружан Кайрат","first_name":"Аружан","last_name":"Кайрат","phone":"+77010000005","iin":"100101600019","date_of_birth":"2010-01-01","gender":"female"}'::jsonb,
      false, v_now, v_now, '+77010000005', v_now, '', '', '', ''
    ),
    (
      '66666666-6666-4666-8666-666666666666',
      '00000000-0000-0000-0000-000000000000',
      'authenticated',
      'authenticated',
      'passenger.boy@senim.demo',
      crypt('Demo12345!', gen_salt('bf')),
      v_now, NULL, NULL, NULL, NULL, v_now,
      '{"provider":"email","providers":["email"]}'::jsonb,
      '{"full_name":"Алихан Ермек","first_name":"Алихан","last_name":"Ермек","phone":"+77010000006","iin":"110707500019","date_of_birth":"2011-07-07","gender":"male"}'::jsonb,
      false, v_now, v_now, '+77010000006', v_now, '', '', '', ''
    )
  ON CONFLICT (id) DO NOTHING;

  -- 2) Email identities
  INSERT INTO auth.identities (
    id,
    user_id,
    identity_data,
    provider,
    provider_id,
    last_sign_in_at,
    created_at,
    updated_at
  )
  VALUES
    (
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1',
      '11111111-1111-4111-8111-111111111111',
      '{"sub":"11111111-1111-4111-8111-111111111111","email":"driver1@senim.demo","email_verified":true,"phone_verified":true}'::jsonb,
      'email',
      'driver1@senim.demo',
      v_now, v_now, v_now
    ),
    (
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2',
      '22222222-2222-4222-8222-222222222222',
      '{"sub":"22222222-2222-4222-8222-222222222222","email":"driver2@senim.demo","email_verified":true,"phone_verified":true}'::jsonb,
      'email',
      'driver2@senim.demo',
      v_now, v_now, v_now
    ),
    (
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa3',
      '33333333-3333-4333-8333-333333333333',
      '{"sub":"33333333-3333-4333-8333-333333333333","email":"driver3@senim.demo","email_verified":true,"phone_verified":true}'::jsonb,
      'email',
      'driver3@senim.demo',
      v_now, v_now, v_now
    ),
    (
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa4',
      '44444444-4444-4444-8444-444444444444',
      '{"sub":"44444444-4444-4444-8444-444444444444","email":"passenger.adult@senim.demo","email_verified":true,"phone_verified":true}'::jsonb,
      'email',
      'passenger.adult@senim.demo',
      v_now, v_now, v_now
    ),
    (
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa5',
      '55555555-5555-4555-8555-555555555555',
      '{"sub":"55555555-5555-4555-8555-555555555555","email":"passenger.girl@senim.demo","email_verified":true,"phone_verified":true}'::jsonb,
      'email',
      'passenger.girl@senim.demo',
      v_now, v_now, v_now
    ),
    (
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa6',
      '66666666-6666-4666-8666-666666666666',
      '{"sub":"66666666-6666-4666-8666-666666666666","email":"passenger.boy@senim.demo","email_verified":true,"phone_verified":true}'::jsonb,
      'email',
      'passenger.boy@senim.demo',
      v_now, v_now, v_now
    )
  ON CONFLICT (provider, provider_id) DO NOTHING;

  -- 3) Normalize profile data after auth trigger
  UPDATE public.profiles
  SET
    full_name = 'Айжан Серикова',
    first_name = 'Айжан',
    last_name = 'Серикова',
    phone = '+77010000001',
    iin = '900715400011',
    date_of_birth = '1990-07-15',
    gender = 'female',
    verification_status = 'approved',
    rating = 4.95
  WHERE id = '11111111-1111-4111-8111-111111111111';

  UPDATE public.profiles
  SET
    full_name = 'Мадина Нурланкызы',
    first_name = 'Мадина',
    last_name = 'Нурланкызы',
    phone = '+77010000002',
    iin = '920320400018',
    date_of_birth = '1992-03-20',
    gender = 'female',
    verification_status = 'approved',
    rating = 4.91
  WHERE id = '22222222-2222-4222-8222-222222222222';

  UPDATE public.profiles
  SET
    full_name = 'Динара Бекетова',
    first_name = 'Динара',
    last_name = 'Бекетова',
    phone = '+77010000003',
    iin = '880911400010',
    date_of_birth = '1988-09-11',
    gender = 'female',
    verification_status = 'approved',
    rating = 4.87
  WHERE id = '33333333-3333-4333-8333-333333333333';

  UPDATE public.profiles
  SET
    full_name = 'Асель Тлеубаева',
    first_name = 'Асель',
    last_name = 'Тлеубаева',
    phone = '+77010000004',
    iin = '950601400010',
    date_of_birth = '1995-06-01',
    gender = 'female',
    verification_status = 'approved',
    rating = 5.00
  WHERE id = '44444444-4444-4444-8444-444444444444';

  UPDATE public.profiles
  SET
    full_name = 'Аружан Кайрат',
    first_name = 'Аружан',
    last_name = 'Кайрат',
    phone = '+77010000005',
    iin = '100101600019',
    date_of_birth = '2010-01-01',
    gender = 'female',
    verification_status = 'approved',
    rating = 5.00
  WHERE id = '55555555-5555-4555-8555-555555555555';

  UPDATE public.profiles
  SET
    full_name = 'Алихан Ермек',
    first_name = 'Алихан',
    last_name = 'Ермек',
    phone = '+77010000006',
    iin = '110707500019',
    date_of_birth = '2011-07-07',
    gender = 'male',
    verification_status = 'approved',
    rating = 5.00
  WHERE id = '66666666-6666-4666-8666-666666666666';

  -- 4) Driver roles
  INSERT INTO public.user_roles (user_id, role)
  VALUES
    ('11111111-1111-4111-8111-111111111111', 'driver'),
    ('22222222-2222-4222-8222-222222222222', 'driver'),
    ('33333333-3333-4333-8333-333333333333', 'driver')
  ON CONFLICT (user_id, role) DO NOTHING;

  -- 5) Driver cards
  INSERT INTO public.drivers (
    id,
    vehicle_make,
    vehicle_model,
    vehicle_plate,
    vehicle_color,
    license_number,
    verification,
    status,
    rating,
    total_rides,
    first_name,
    last_name,
    vehicle_country,
    child_seat,
    application_status,
    submitted_at,
    reviewed_at
  )
  VALUES
    (
      '11111111-1111-4111-8111-111111111111',
      'Toyota', 'Camry', '701AAA12', 'White', 'DL-000001',
      'approved', 'online', 4.95, 148,
      'Айжан', 'Серикова', 'KZ', true, 'approved', v_now, v_now
    ),
    (
      '22222222-2222-4222-8222-222222222222',
      'Hyundai', 'Elantra', '702BBB12', 'Silver', 'DL-000002',
      'approved', 'online', 4.91, 93,
      'Мадина', 'Нурланкызы', 'KZ', true, 'approved', v_now, v_now
    ),
    (
      '33333333-3333-4333-8333-333333333333',
      'Kia', 'Rio', '703CCC12', 'Black', 'DL-000003',
      'approved', 'online', 4.87, 76,
      'Динара', 'Бекетова', 'KZ', false, 'approved', v_now, v_now
    )
  ON CONFLICT (id) DO UPDATE SET
    vehicle_make = EXCLUDED.vehicle_make,
    vehicle_model = EXCLUDED.vehicle_model,
    vehicle_plate = EXCLUDED.vehicle_plate,
    vehicle_color = EXCLUDED.vehicle_color,
    license_number = EXCLUDED.license_number,
    verification = EXCLUDED.verification,
    status = EXCLUDED.status,
    rating = EXCLUDED.rating,
    total_rides = EXCLUDED.total_rides,
    first_name = EXCLUDED.first_name,
    last_name = EXCLUDED.last_name,
    vehicle_country = EXCLUDED.vehicle_country,
    child_seat = EXCLUDED.child_seat,
    application_status = EXCLUDED.application_status,
    submitted_at = EXCLUDED.submitted_at,
    reviewed_at = EXCLUDED.reviewed_at;

  -- 6) Driver map locations in Aktau
  INSERT INTO public.driver_locations (
    driver_id,
    lat,
    lng,
    heading,
    speed,
    accuracy,
    updated_at
  )
  VALUES
    ('11111111-1111-4111-8111-111111111111', 43.6517, 51.1975, 120, 0, 5, v_now),
    ('22222222-2222-4222-8222-222222222222', 43.6582, 51.1884, 45, 0, 5, v_now),
    ('33333333-3333-4333-8333-333333333333', 43.6431, 51.1812, 275, 0, 5, v_now)
  ON CONFLICT (driver_id) DO UPDATE SET
    lat = EXCLUDED.lat,
    lng = EXCLUDED.lng,
    heading = EXCLUDED.heading,
    speed = EXCLUDED.speed,
    accuracy = EXCLUDED.accuracy,
    updated_at = EXCLUDED.updated_at;

  -- 7) Wallet balances
  UPDATE public.wallets SET balance = 125000, pending_balance = 0, currency = 'KZT' WHERE user_id = '11111111-1111-4111-8111-111111111111';
  UPDATE public.wallets SET balance = 98500, pending_balance = 0, currency = 'KZT' WHERE user_id = '22222222-2222-4222-8222-222222222222';
  UPDATE public.wallets SET balance = 64300, pending_balance = 0, currency = 'KZT' WHERE user_id = '33333333-3333-4333-8333-333333333333';
  UPDATE public.wallets SET balance = 20000, pending_balance = 0, currency = 'KZT' WHERE user_id = '44444444-4444-4444-8444-444444444444';
  UPDATE public.wallets SET balance = 5000, pending_balance = 0, currency = 'KZT' WHERE user_id = '55555555-5555-4555-8555-555555555555';
  UPDATE public.wallets SET balance = 3500, pending_balance = 0, currency = 'KZT' WHERE user_id = '66666666-6666-4666-8666-666666666666';

  -- 8) One child for the adult female passenger demo
  INSERT INTO public.passenger_children (
    id,
    mother_id,
    full_name,
    iin,
    birth_date,
    created_at,
    updated_at
  )
  VALUES (
    '77777777-7777-4777-8777-777777777777',
    '44444444-4444-4444-8444-444444444444',
    'Томирис Тлеубай',
    '180505600017',
    '2018-05-05',
    v_now,
    v_now
  )
  ON CONFLICT (id) DO NOTHING;
END $$;
