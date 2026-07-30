import "server-only";
import type { Order } from "@/src/types";

// Заказы, ждущие оплаты (для раздела «Заказы» у бухгалтера в боте): статус
// confirmed_waiting_payment или overdue. Отдельный REST-запрос сервисным ключом,
// admin.ts намеренно не трогаем (там запросы к БД — запретная зона).

export type AwaitingPaymentRow = Pick<
  Order,
  | "id"
  | "order_number"
  | "total_amount"
  | "delivery_amount"
  | "created_at"
  | "due_date"
  | "company_name"
  | "status"
>;

export async function fetchAwaitingPaymentOrders(): Promise<AwaitingPaymentRow[]> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, "");
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return [];

  const params = new URLSearchParams({
    status: "in.(confirmed_waiting_payment,overdue)",
    select: "id,order_number,total_amount,delivery_amount,created_at,due_date,company_name,status",
    order: "created_at.desc",
    limit: "50",
  });

  const response = await fetch(`${url}/rest/v1/orders?${params.toString()}`, {
    headers: { apikey: key, Authorization: `Bearer ${key}` },
    cache: "no-store",
  });

  if (!response.ok) return [];
  return (await response.json()) as AwaitingPaymentRow[];
}

/** Оплаченные заказы (для второй кнопки бухгалтера «Оплаченные»). */
export async function fetchPaidOrders(): Promise<AwaitingPaymentRow[]> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, "");
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return [];

  const params = new URLSearchParams({
    payment_status: "eq.paid",
    status: "not.in.(canceled,cancelled)",
    select: "id,order_number,total_amount,delivery_amount,created_at,due_date,company_name,status",
    order: "paid_at.desc.nullslast",
    limit: "30",
  });

  const response = await fetch(`${url}/rest/v1/orders?${params.toString()}`, {
    headers: { apikey: key, Authorization: `Bearer ${key}` },
    cache: "no-store",
  });

  if (!response.ok) return [];
  return (await response.json()) as AwaitingPaymentRow[];
}
