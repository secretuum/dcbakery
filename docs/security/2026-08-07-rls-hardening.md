# Безопасность: закрытие доступа к данным через PostgREST (RLS/гранты)

_Составлено 07.08.2026 по итогам верификации стороннего аудита по фактическому коду и дампу грантов прод-БД. **Черновик для ревью разработчиком.** В код репозитория ничего не применялось; миграции — зона ручного ревью._

## Суть инцидента

Публичный ключ `NEXT_PUBLIC_SUPABASE_ANON_KEY` виден в бандле фронтенда. Роли `anon`/`authenticated` в PostgREST имеют прямой доступ к чувствительным таблицам:

- **`magic_link_tokens`** — RLS НЕ включён (`supabase/migrations/202607070002_create_magic_link_tokens.sql` не содержит `ENABLE ROW LEVEL SECURITY`), у `anon` есть `SELECT`. Токен входа хранится **сырым**. → любой с публичным ключом читает `(email, token)` действующих токенов и логинится в чужой ЛК. Авторизация не требуется. **critical.**
- **`orders`, `order_items`, `clients`, `whatsapp_clients`, `payment_events`** — RLS включён, но политики выданы роли `authenticated` с `USING(true)` без привязки к владельцу (`202606200001_create_orders.sql:64`, `202607140001_clients_and_credit.sql:33`, `202606230002_create_whatsapp_clients.sql:30`). Публичный клиентский signup включён (`src/lib/client-auth.ts`, `app/api/profile/register/route.ts`). → любой зарегистрировавшийся читает все заказы/ПДн/кредитные лимиты через `/rest/v1/...` со своим `authenticated`-JWT. **critical.**

Приложение **не** зависит от этих грантов: весь доступ к данным идёт через `SUPABASE_SERVICE_ROLE_KEY` (`src/lib/supabase/admin.ts` и другие `src/lib/**` стора; все 17 вызовов `/rest/v1/` серверные, ни один не использует анонимный ключ). `service_role` обходит RLS и гранты, поэтому ужесточение доступа для `anon`/`authenticated` фронт не ломает.

## Шаг 1. Немедленная затычка (SQL Editor, обратимо)

```sql
alter table public.magic_link_tokens enable row level security;

revoke select, insert, update, delete
  on public.orders, public.order_items, public.clients,
     public.whatsapp_clients, public.magic_link_tokens, public.payment_events
  from anon, authenticated;
```

Проверка после применения (должно быть пусто для anon/authenticated):

```sql
select table_name, grantee, privilege_type
from information_schema.role_table_grants
where table_name in ('orders','order_items','clients','whatsapp_clients','magic_link_tokens','payment_events')
  and grantee in ('anon','authenticated')
order by table_name, grantee;

select relname, relrowsecurity from pg_class
where relname in ('magic_link_tokens','orders','clients','whatsapp_clients');
```

Откат: `grant select on public.<table> to authenticated;`

## Шаг 2. Постоянный фикс — новой миграцией (ревью + применение человеком)

Затычка из шага 1 не переживёт `db reset`/пересборку окружения. Ту же логику нужно зафиксировать миграцией. Черновик (имя-дату подставит разработчик):

```sql
-- magic_link_tokens: включить RLS, отозвать доступ публичных ролей
alter table public.magic_link_tokens enable row level security;
revoke all on public.magic_link_tokens from anon, authenticated;

-- чувствительные таблицы: отозвать прямой доступ публичных ролей (доступ только через service_role)
revoke select, insert, update, delete
  on public.orders, public.order_items, public.clients,
     public.whatsapp_clients, public.payment_events
  from anon, authenticated;

-- Опционально, если политики USING(true) для authenticated больше не нужны — удалить их,
-- чтобы модель доступа была явной (имена политик уточнить по факту):
--   drop policy if exists "admin_read_orders" on public.orders;
--   ... и аналогично для clients / whatsapp_clients / order_items / payment_events
```

### Рекомендуемая доработка (defense-in-depth, отдельным PR)

- **Хэшировать magic-link токен.** Сейчас `src/lib/magic-link-store.ts` пишет и сверяет токен сырым. Перейти на хранение `sha256(token)` и сверку по хэшу — как уже сделано для `whatsapp_registration_tokens` (`src/lib/registration/reg-link.ts`: `createHash('sha256')...`, колонка `token_hash`). Тогда даже при будущей ошибке в RLS утёкшие строки не дадут рабочих токенов. Меняются: миграция (колонка `token_hash` вместо `token`) + `magic-link-store.ts` (хэш при записи и при сверке).
- **Проверить `app_settings`** (фичефлаги/`site_content`): у `authenticated` может быть `INSERT/UPDATE` — потенциально переключение флагов бота. Отозвать аналогично, если приложение пишет туда только `service_role`.
- **Отключить публичный signup в Supabase Auth**, если клиентская саморегистрация не нужна как отдельный Supabase-пользователь (снижает поверхность #1). Учесть, что сейчас `app/api/profile/register` вызывает `/auth/v1/signup`.

## Проверка, что фронт не сломан

Все обращения к таблицам — серверные через `service_role`; анонимный ключ используется только для `/auth/v1/*` (`src/lib/client-auth.ts`, `src/lib/supabase/auth.ts`, `admin-identity.ts`, `superadmin.ts`, `ResetPasswordClient.tsx`). Прямых `.from('<таблица>')` с anon-ключом в браузере нет. После шага 1 прогнать смоук: вход по коду (magic-link), регистрация клиента, оформление заказа, админка.
