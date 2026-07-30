import type { ClientOrderSummary } from "@/src/types";

// Прогресс акции «5 десертов»: набранный объём заказов клиента за текущую
// календарную неделю (Пн–Вс) по времени Алматы. Чистая функция без Date.now()
// внутри (время передаётся аргументом) — считается на клиенте из уже загруженной
// истории заказов, поэтому бэкенд/запросы не нужны.

export const PROMO_WEEKLY_THRESHOLD = 100000;

// Алматы — UTC+5 круглый год (переходов на летнее время нет).
const ALMATY_OFFSET_MS = 5 * 60 * 60 * 1000;

/** Границы текущей недели [Пн 00:00, следующий Пн 00:00) по Алматы, в UTC-мс. */
export function almatyWeekRange(nowMs: number): { startMs: number; endMs: number } {
  const local = new Date(nowMs + ALMATY_OFFSET_MS);
  const mondayIndex = (local.getUTCDay() + 6) % 7; // Пн=0 … Вс=6
  const localMidnight = Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate());
  const startMs = localMidnight - mondayIndex * 86_400_000 - ALMATY_OFFSET_MS;
  return { startMs, endMs: startMs + 7 * 86_400_000 };
}

/**
 * Сумма заказов (по позициям) за текущую неделю, кроме отменённых.
 * Пустая история → 0 (шкала стартует с нуля).
 */
export function weeklyPromoCollected(orders: ClientOrderSummary[], nowMs: number): number {
  const { startMs, endMs } = almatyWeekRange(nowMs);
  return orders.reduce((sum, order) => {
    if (order.status === "canceled" || order.status === "cancelled") return sum;
    const created = Date.parse(order.created_at);
    if (Number.isNaN(created) || created < startMs || created >= endMs) return sum;
    return sum + Number(order.total_amount || 0);
  }, 0);
}
