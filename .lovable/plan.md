## Что уже есть (не трогаем дизайн, переиспользуем)

- ИИН-парсер (`src/lib/iin.ts`) — пол + дата рождения + контрольная сумма.
- Storage bucket `verification` (приватный) с RLS.
- Таблицы `profiles`, `drivers`, `verification_requests`, `notifications`, `user_roles`.
- Колонки в `profiles`: `iin`, `date_of_birth`, `gender`, `selfie_path`, `verification_status`.
- Страницы: `/verify-identity`, `/become-driver`, `/admin/verifications`, `/auth`.
- Камера `CameraCapture` (только живое селфи, галерея отключена).
- Гендер-чек 18+ женский в `submit_passenger_verification`.

## Что добавим

### 1. БД — миграция

**`profiles`** — добавить:
- `first_name`, `last_name`, `patronymic`, `phone`, `live_photo_url` (text — публичный signed-style путь = `selfie_path`), `verification_comment`, `verified_at`, `verified_by` (uuid → auth.users).

**Новая таблица `driver_documents`** (один документ = одна строка):
- `id`, `driver_id` (→ auth.users), `kind` enum (`identity`, `license`, `vehicle_registration`, `vehicle_documents`), `file_path`, `mime_type`, `status` enum (`pending`, `approved`, `rejected`), `comment`, `uploaded_at`, `reviewed_at`, `reviewed_by`.
- UNIQUE(driver_id, kind) — переотправка обновляет ту же строку.
- RLS: владелец читает/пишет свои; админ всё.
- GRANT на `authenticated` и `service_role`.

**`drivers`** — добавить:
- `first_name`, `last_name`, `patronymic`, `vehicle_country`, `child_seat` boolean, `application_status` enum (`pending`, `needs_reupload`, `approved`, `rejected`), `submitted_at`, `reviewed_at`, `reviewed_by`, `review_comment`. Существующий `verification` оставляем для обратной совместимости.

**RPC**:
- `submit_driver_application(...)` — проверяет: пользователь верифицирован как пассажир, пол = female (из `profiles.gender`), все 4 документа загружены. Иначе RAISE с понятным сообщением. Создаёт/обновляет `drivers` + 4 строки `driver_documents` в pending, шлёт уведомление.
- `reupload_driver_document(_kind, _path, _mime)` — обновляет одну строку, status→pending, шлёт уведомление админам.
- `admin_review_document(_doc_id, _decision, _comment)` — admin-only; меняет статус документа + комментарий + уведомление водителю. Если все 4 approved → `drivers.application_status='approved'`, `verification='approved'`, выдаёт роль `driver`. Если есть rejected → `needs_reupload`.
- Уникальность телефона/ИИН в `profiles` (UNIQUE + понятная ошибка в trigger `handle_new_user`).

**Дубли**: добавить UNIQUE на `profiles.iin` (где не NULL), UNIQUE на `profiles.phone` (где не NULL).

### 2. Регистрация пассажира `/auth`

- Поля: `first_name`, `last_name`, `patronymic?`, `phone`, `iin`, `password`.
- При вводе ИИН — мгновенно показывается read-only «Дата рождения» и «Пол» из `parseIin`. Поля не редактируются.
- Если пол = male → блокирующее сообщение «Приложение предназначено только для женщин и детей.»; signup не вызывается.
- При успешном signup — `raw_user_meta_data` содержит `full_name = "{last} {first} {patronymic}"`, `phone`, `iin`. Триггер `handle_new_user` распакует в `profiles` (обновим триггер).
- Редирект на `/verify-identity` для живого селфи (как сейчас).

### 3. `/verify-identity`

- Камера только (галерея уже отключена, ничего не меняем).
- ИИН/имя берём из profiles, форма отображает их read-only; пользователь делает 2 селфи.
- `submit_passenger_verification` уже использует данные → проставит `verification_status = 'manual_review'` (убираем `auto_approved` — по ТЗ только админ approves). Уведомления уже шлются.

### 4. `/become-driver`

Существующая страница расширяется (не редизайн, добавляем поля):
- Read-only ИИН/ДР/пол из profiles.
- Поля ФИО (предзаполнены из profiles, можно править).
- 4 файловых поля (Identity / License / Vehicle Registration / Vehicle Documents) — accept `.pdf,.jpg,.jpeg,.png`, валидация MIME + размер ≤ 10 МБ.
- Поля авто: plate, country, **Child Seat: Yes/No** (радио).
- Кнопка «Отправить заявку» → upload в `verification/<uid>/driver/<kind>-<ts>.<ext>` → `submit_driver_application`.
- Серверная проверка пола: если не female → ошибка «Только женщины могут зарегистрироваться в качестве водителя.» Заявка не создаётся.
- Если status=`needs_reupload`: показываем список отклонённых документов с комментарием и кнопкой «Загрузить заново» (на одну строку) → `reupload_driver_document`.

### 5. Админ-панель `/admin/verifications`

- Существующий список заявок passenger.
- Добавим вкладку «Водители»: список `drivers` со статусом pending/needs_reupload, фото селфи, ФИО, ИИН, ДР, пол, авто (plate, country, child_seat), 4 документа со своим статусом.
- На каждый документ — кнопки **Approve / Reject + комментарий** (вызов `admin_review_document`).
- Кнопка «Одобрить заявку» активна только когда все 4 approved (или авто-approve в RPC при approve последнего).

### 6. Уведомления

Идут через таблицу `notifications` (уже отображаются в UI колокольчиком, не меняем):
- Пассажир: identity approved/rejected.
- Водитель: application submitted, document approved/rejected, application approved/rejected.

### 7. Безопасность / RLS

- `driver_documents`: владелец SELECT/UPDATE своих (статус только через RPC), админ — всё (через `has_role`).
- `drivers`: admin SELECT всё; владелец — своё.
- `storage.objects` bucket `verification`: уже path-scoped по uid; добавим policy для админов SELECT всех файлов (для просмотра в админке через signed URL).
- Все статус-переходы — только через SECURITY DEFINER RPC, в которых проверяется `has_role(auth.uid(),'admin')`.

## Технические детали

- Триггер `handle_new_user` расширяется: пишет `first_name`, `last_name`, `patronymic`, `phone`, `iin`, `date_of_birth`, `gender` (последние два — через парсер на стороне клиента, передаются в `raw_user_meta_data`).
- Подписанные URL для админа на просмотр документов — серверная функция `getSignedDocUrl({ path })` с `requireSupabaseAuth` + проверкой `has_role admin`.
- Валидация файлов на клиенте: `accept="application/pdf,image/jpeg,image/png"`, `file.size <= 10*1024*1024`, MIME проверка перед upload.
- Проверка дублей: UNIQUE индексы + перехват `23505` в auth/onboarding с понятными сообщениями.

## План реализации (порядок)

1. Миграция 1: типы, новые колонки `profiles`/`drivers`, таблица `driver_documents`, RLS, GRANT, UNIQUE.
2. Миграция 2: RPC `submit_driver_application`, `reupload_driver_document`, `admin_review_document` + обновление `handle_new_user`.
3. Server fn `get-signed-doc-url.functions.ts`.
4. UI `/auth`: новые поля, IIN-derived блок, гендер-чек.
5. UI `/become-driver`: ФИО, 4 файла (PDF+img), country, child_seat, обработка `needs_reupload`.
6. UI `/admin/verifications`: вкладка «Водители» с per-document действиями.
7. Хуки уведомлений (уже работают, только добавим INSERT в новых RPC).

## Что НЕ делаем

- Не редизайним существующие экраны — только дополняем поля и блоки в текущей вёрстке (Card, Button, Input, RadioGroup из shadcn).
- Не трогаем `CameraCapture`, маршрутизатор, дизайн-токены, лендинг.
- Не используем Edge Functions (по конвенции проекта — `createServerFn`).

## Подтверждение

Если план ок — запускаю миграции и UI по порядку. Если хочешь сузить (например, только пассажирский флоу или только водительский) — скажи.