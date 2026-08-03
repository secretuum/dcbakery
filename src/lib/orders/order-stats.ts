import "server-only";
// Агрегаты заказов для дашборда админки через RPC admin_order_stats (миграция 202608030001).
// Возвращает null, если RPC недоступен (миграция не применена / нет конфигурации).

const SUPABASE_TIMEOUT_MS = 10000;

export type AdminOrderStats = {
  orders_total: number;
  paid_revenue: number;
  paid_count: number;
  outstanding_amount: number;
  outstanding_count: number;
  overdue_amount: number;
  overdue_count: number;
  pending_count: number;
  in_progress_count: number;
};

export async function fetchAdminOrderStats(): Promise<AdminOrderStats | null> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), SUPABASE_TIMEOUT_MS);
  try {
    const res = await fetch(`${url.replace(/\/$/, "")}/rest/v1/rpc/admin_order_stats`, {
      method: "POST",
      headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: "{}",
      signal: controller.signal,
      cache: "no-store",
    });
    if (!res.ok) return null;
    const raw = (await res.json()) as Record<string, unknown>;
    const num = (v: unknown) => Number(v) || 0;
    return {
      orders_total: num(raw.orders_total),
      paid_revenue: num(raw.paid_revenue),
      paid_count: num(raw.paid_count),
      outstanding_amount: num(raw.outstanding_amount),
      outstanding_count: num(raw.outstanding_count),
      overdue_amount: num(raw.overdue_amount),
      overdue_count: num(raw.overdue_count),
      pending_count: num(raw.pending_count),
      in_progress_count: num(raw.in_progress_count),
    };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}
