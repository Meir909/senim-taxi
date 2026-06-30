# План изменений

## 1. Админ: блокировка/удаление пассажира

**Схема (миграция):**
- `profiles.blocked_at timestamptz`, `profiles.blocked_reason text`, `profiles.blocked_by uuid`.
- RPC `admin_block_user(_user_id, _reason)`: только `has_role('admin')`. Ставит `blocked_at=now()`, `verification_status='rejected'`, удаляет все роли пользователя (`user_roles`), переводит активного водителя `offline`, отменяет активные поездки пассажира (статусы `requested/searching/accepted/driver_arriving/driver_arrived` → `cancelled` с причиной `blocked_by_admin`). Шлёт уведомление.
- RPC `admin_unblock_user(_user_id)`.
- RPC `admin_delete_user(_user_id)`: только админ. Через `supabaseAdmin` (server fn `deleteUserAdmin` с `requireSupabaseAuth` + `has_role` проверкой) вызывает `auth.admin.deleteUser` → каскадно удалит профиль/роли/кошелёк (FK on delete cascade — проверим, добавим где надо).
- Гейт входа: `_authenticated/route.tsx` — если `profiles.blocked_at IS NOT NULL`, разлогинить и редирект на `/auth?blocked=1`.

**UI:** в `/admin/verifications` (вкладка Пассажиры) на карточке — кнопки «Заблокировать» (с обязательным комментарием) и «Удалить». Подтверждение через `AlertDialog`.

## 2. Рейтинг + фото друг друга

Рейтинг водителя пассажиром уже есть (`rate_ride`). Добавляем:
- На `passenger.ride.$rideId.tsx`: после accept показывать карточку водителя (аватар = `drivers.selfie_path` через signed URL, имя, рейтинг `drivers.rating`, машина).
- На `driver.tsx` при появлении оффера: фото пассажира (`profiles.live_photo_url`/`selfie_path` через signed URL) + имя + рейтинг пассажира.
- Рейтинг пассажира: `profiles.rating numeric default 5.00`. Триггер/обновление в `rate_ride` уже есть для водителя — добавим аналогично для `passenger_rating` → пересчёт `profiles.rating`.
- На завершённой поездке водитель тоже видит экран оценки пассажира (UI в `driver.tsx`).

Подписи signed URL генерируем через серверную функцию `getSignedAvatar(userId, kind)` чтобы не открывать bucket публично.

## 3. Завершить поездку только у точки B

В `complete_ride` уже принимает `_fare/_distance/_duration` без проверки координат. Добавим параметры `_lat, _lng` и проверим расстояние до `dropoff` ≤ 150 м (формула haversine). Если дальше — ошибка «Подъезжайте к точке назначения».

UI в `driver.tsx`: кнопка «Завершить поездку» disabled пока `distance(currentPos, dropoff) > 0.15 км`. Текущую позицию уже шлём в `driver_locations`.

## 4. Единая карта для двух точек + модалка

Сейчас `passenger.tsx` рендерит два `AddressPicker` (две карты). Переделаем:
- `passenger.tsx` — полноэкранная карта (под хедер): `h-[calc(100dvh-…)] w-full`, маркеры A/B, плавающая нижняя панель с двумя полями («Откуда», «Куда») и кнопкой «Заказать».
- Тап по полю открывает `Dialog` с поиском адреса (используем существующий поиск из `AddressPicker`); выбор адреса возвращает координаты в форму; маркер на той же карте обновляется.
- Долгий тап / тап по карте, когда выбрано активное поле, ставит точку.
- Никаких отдельных карт — один экземпляр `MapGL`.

Дизайн страницы не меняется радикально — те же `Card`, кнопки, тот же визуальный стиль; меняется только layout (full-bleed карта + bottom-sheet).

## Технические детали

- Bucket `verification` приватный → signed URL генерим в server fn (TTL 5 мин). Кэш на клиенте.
- Все новые RPC: `SECURITY DEFINER`, `search_path=public`, проверка `has_role('admin')` где нужно.
- `admin_delete_user` — серверная функция с `requireSupabaseAuth`, динамический `await import('@/integrations/supabase/client.server')`, проверка admin роли через `has_role`.
- FK для каскада: убедиться что `profiles/wallets/user_roles/drivers/driver_documents` имеют `ON DELETE CASCADE` на `auth.users(id)` (где нет — добавить в миграции).
- Realtime: подписки уже идут на `rides`/`driver_locations`/`ride_offers` — не меняем.

## Файлы

- Новая миграция (блокировка, рейтинг пассажира, каскады, изменение `complete_ride`, новые RPC).
- `src/lib/admin.functions.ts` — `deleteUserAdmin`.
- `src/lib/signed-url.functions.ts` — `getAvatarUrl`.
- `src/routes/_authenticated/route.tsx` — проверка `blocked_at` (если файл интеграции — добавим обёртку в `__root.tsx` или отдельный hook).
- `src/routes/_authenticated/admin.verifications.tsx` — кнопки блок/удалить.
- `src/routes/_authenticated/passenger.tsx` — переписать UI (одна карта + модалки).
- `src/routes/_authenticated/passenger.ride.$rideId.tsx` — карточка водителя.
- `src/routes/_authenticated/driver.tsx` — фото пассажира на оффере, гейт «Завершить», экран оценки пассажира.
- `src/components/AddressPicker.tsx` — выделить поиск в переиспользуемый `AddressSearchDialog`.
