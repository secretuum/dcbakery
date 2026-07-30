import "server-only";
import type { Order } from "@/src/types";

// Пометка просроченных заявок: confirmed_waiting_payment с прошедшим due_date →
// status = 'overdue'. Один атомарный PATCH через Supabase REST сервисным ключом,
// возвращает изменённые заявки (для уведомления). Не трогает admin.ts.
//
// ВНИМАНИЕ: требует, чтобы CHECK на orders.status допускал 'overdue' (мини-миграция).
// Запрос НЕ ловит уже-overdue заявки (они не в статусе confirmed_waiting_payment),
// поэтому каждая заявка помечается ровно один раз — без ежедневного повтора.

export type OverdueRow = Pick<
  Order,
  | "id"
  | "order_number"
  | "total_amount"
  | "delivery_amount"
  | "due_date"
  | "telegram_message_id"
>;

export async function markOverdueOrders(today: string): Promise<OverdueRow[]> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, "");
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return [];

  // due_date=lt.<today> сам по себе отсекает NULL (сравнение с null → не проходит).
  const params = new URLSearchParams({
    status: "eq.confirmed_waiting_payment",
    due_date: `lt.${today}`,
    select: "id,order_number,total_amount,delivery_amount,due_date,telegram_message_id",
  });

  const response = await fetch(`${url}/rest/v1/orders?${params.toString()}`, {
    method: "PATCH",
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
    },
    body: JSON.stringify({ status: "overdue" }),
  });

  if (!response.ok) {
    throw new Error(`overdue patch failed: ${response.status} ${await response.text()}`);
  }

  return (await response.json()) as OverdueRow[];
}

export type UnpaidWorkRow = Pick<
  Order,
  | "id"
  | "order_number"
  | "total_amount"
  | "delivery_amount"
  | "due_date"
  | "status"
>;

/**
 * Неоплаченные заказы, УЖЕ взятые в работу/доставку, с прошедшим сроком оплаты.
 * Их статус НЕ меняем (иначе затрём «в работе»/«доставляется»), только напоминаем —
 * поэтому это SELECT, а не PATCH (напоминание может повторяться, пока не оплатят).
 */
export async function fetchUnpaidWorkOverdue(today: string): Promise<UnpaidWorkRow[]> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, "");
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return [];

  const params = new URLSearchParams({
    payment_status: "neq.paid",
    status: "in.(in_progress,delivering)",
    due_date: `lt.${today}`,
    select: "id,order_number,total_amount,delivery_amount,due_date,status",
    order: "due_date.asc",
  });

  const response = await fetch(`${url}/rest/v1/orders?${params.toString()}`, {
    headers: { apikey: key, Authorization: `Bearer ${key}` },
    cache: "no-store",
  });

  if (!response.ok) return [];
  return (await response.json()) as UnpaidWorkRow[];
}
