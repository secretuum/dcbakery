import "server-only";
import type { Order } from "@/src/types";

// Снятие ошибочной отметки оплаты (этап 0 платёжного аудита).
// Отдельный модуль: запросы к БД намеренно не добавляются в admin.ts.

function getConfig() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    return null;
  }

  return { restUrl: `${supabaseUrl.replace(/\/$/, "")}/rest/v1`, serviceRoleKey };
}

/**
 * Атомарно снимает отметку оплаты: UPDATE проходит только если payment_status
 * всё ещё 'paid' (гонка с повторным кликом/вебхуком исключена). Возвращает
 * обновлённый заказ или null, если снимать уже нечего.
 * payment_status возвращается к состоянию до оплаты (счёт отправлен/готов), paid_at
 * очищается. Статус заказа НЕ трогаем (оплата — отдельная ось), кроме легаси-случая
 * status='paid' (старая модель) — его возвращаем в 'confirmed_waiting_payment',
 * иначе заказ залипнет (нельзя ни отметить оплату, ни завершить).
 */
export async function unmarkOrderPaid(order: Order): Promise<Order | null> {
  const config = getConfig();

  if (!config) {
    throw new Error("Supabase admin credentials are not configured");
  }

  const restoredPaymentStatus = order.payment_link_sent_at
    ? "payment_link_sent"
    : order.payment_url
      ? "payment_link_created"
      : "unpaid";

  const params = new URLSearchParams({
    id: `eq.${order.id}`,
    payment_status: "eq.paid",
  });

  const response = await fetch(`${config.restUrl}/orders?${params}`, {
    method: "PATCH",
    headers: {
      apikey: config.serviceRoleKey,
      Authorization: `Bearer ${config.serviceRoleKey}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
    },
    body: JSON.stringify({
      // Снимаем только оплату; статус заказа не меняем (оплата — отдельная ось),
      // кроме легаси status='paid' → возвращаем в 'confirmed_waiting_payment'.
      paid_at: null,
      payment_status: restoredPaymentStatus,
      ...(order.status === "paid" ? { status: "confirmed_waiting_payment" } : {}),
    }),
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Failed to unmark payment: ${response.status} ${await response.text()}`);
  }

  const [updated] = (await response.json()) as Order[];
  return updated ?? null;
}
