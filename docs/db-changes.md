# Изменения схемы БД, применённые вне папки миграций

По правилам проекта файлы в `supabase/migrations/` не создаются автоматически.
Здесь фиксируется SQL, применённый к проду напрямую (с одобрения владельца),
чтобы схему можно было воспроизвести.

## 2026-07-18 — этап 0 платёжного аудита

Уникальность внешних идентификаторов платёжных событий (защита от повторной
записи одного webhook-события). Частичный индекс: NULL-значения не конфликтуют.

```sql
create unique index if not exists uq_payment_events_event_id
  on payment_events(event_id)
  where event_id is not null;
```

Проверка перед применением показала отсутствие дубликатов (`group by event_id
having count(*) > 1` → 0 строк).

## 2026-07-18 — этап 1: снапшоты счетов

Фиксация версии заказа на момент выставления счёта (подтверждения менеджером):
если заказ изменят после выставления, по снапшоту видно, на что был счёт.

```sql
create table if not exists invoice_snapshots (
  id uuid primary key default gen_random_uuid(),
  order_id uuid references orders(id) on delete cascade,
  order_number text not null,
  total_amount numeric(12,2) not null,
  items jsonb not null,
  confirmed_at timestamptz not null,
  created_at timestamptz not null default now()
);
create index if not exists idx_invoice_snapshots_order on invoice_snapshots(order_id, created_at desc);
alter table invoice_snapshots enable row level security;
create policy "admin_read_invoice_snapshots" on invoice_snapshots for select to authenticated using (true);
```

## 2026-07-18 — этап 2 (подготовка Halyk): попытки платежа

Отдельная сущность платёжной попытки с числовым invoice_id из sequence —
требование Halyk ePay (invoiceID: 6–15 цифр, уникальный на каждую операцию).
Старт 100001 гарантирует минимум 6 цифр без коллизий.

```sql
create sequence if not exists payment_invoice_seq start 100001;

create table if not exists payments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders(id) on delete cascade,
  provider text not null check (provider in ('halyk','freedom','manual','kaspi_later')),
  invoice_id bigint not null unique default nextval('payment_invoice_seq'),
  amount numeric(12,2) not null,
  currency text not null default 'KZT',
  status text not null default 'created' check (status in ('created','pending','paid','failed','expired','canceled','refunded')),
  external_id text,
  secret_hash text,
  failure_reason text,
  created_at timestamptz not null default now(),
  paid_at timestamptz,
  expires_at timestamptz,
  refunded_amount numeric(12,2)
);
create index if not exists idx_payments_order on payments(order_id, created_at desc);
create index if not exists idx_payments_status on payments(status);
alter table payments enable row level security;
create policy "admin_read_payments" on payments for select to authenticated using (true);
```
