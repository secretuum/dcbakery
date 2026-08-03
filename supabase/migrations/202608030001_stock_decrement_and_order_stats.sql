-- ============================================================================
-- Атомарное списание остатка + агрегаты заказов для дашборда админки.
-- Применять в Supabase → SQL Editor (или через миграции). Идемпотентно.
-- ============================================================================

-- 1) АТОМАРНОЕ СПИСАНИЕ ОСТАТКА ------------------------------------------------
-- Проблема read-modify-write: приложение читало остаток из кэша и писало
-- (current - qty) — под конкуренцией/ретраем списание терялось или двоилось.
-- Здесь декремент атомарен на стороне БД. Остаток «живёт» в catalog_product_overrides;
-- для товара БЕЗ строки-оверрайда приложение передаёт эффективный остаток из статики
-- как p_fallback_stock (используется ТОЛЬКО при первом INSERT). Дальнейшие списания
-- идут от значения в БД. GREATEST(...,0) не даёт уйти в минус.
create or replace function public.decrement_product_stock(
  p_product_id text,
  p_qty numeric,
  p_fallback_stock numeric
) returns numeric
language sql
as $$
  insert into public.catalog_product_overrides (product_id, stock_qty, updated_at)
  values (p_product_id, greatest(0, coalesce(p_fallback_stock, 0) - p_qty), now())
  on conflict (product_id) do update
    set stock_qty = greatest(0, public.catalog_product_overrides.stock_qty - p_qty),
        updated_at = now()
  returning stock_qty;
$$;

comment on function public.decrement_product_stock(text, numeric, numeric) is
  'Атомарно списывает p_qty со stock_qty товара. p_fallback_stock — эффективный остаток из приложения, используется только при первом INSERT (товар без оверрайда).';

-- 2) АГРЕГАТЫ ЗАКАЗОВ ДЛЯ ДАШБОРДА --------------------------------------------
-- Одним запросом: выручка (оплаченные), дебиторка (ждут оплаты/в работе/доставка),
-- просрочка, счётчики по ключевым статусам. Сумма = total_amount + delivery_amount.
create or replace function public.admin_order_stats()
returns json
language sql
stable
as $$
  select json_build_object(
    'orders_total', count(*),
    'paid_revenue', coalesce(sum(total_amount + coalesce(delivery_amount, 0))
                      filter (where payment_status = 'paid'), 0),
    'paid_count', count(*) filter (where payment_status = 'paid'),
    'outstanding_amount', coalesce(sum(total_amount + coalesce(delivery_amount, 0))
                      filter (where payment_status <> 'paid'
                        and status in ('confirmed_waiting_payment','overdue','in_progress','delivering')), 0),
    'outstanding_count', count(*) filter (where payment_status <> 'paid'
                      and status in ('confirmed_waiting_payment','overdue','in_progress','delivering')),
    'overdue_amount', coalesce(sum(total_amount + coalesce(delivery_amount, 0))
                      filter (where status = 'overdue' and payment_status <> 'paid'), 0),
    'overdue_count', count(*) filter (where status = 'overdue' and payment_status <> 'paid'),
    'pending_count', count(*) filter (where status = 'pending_manager_confirmation'),
    'in_progress_count', count(*) filter (where status in ('in_progress','delivering'))
  )
  from public.orders;
$$;

comment on function public.admin_order_stats() is
  'Агрегаты заказов для дашборда админки: выручка (оплаченные), дебиторка, просрочка, счётчики статусов.';
