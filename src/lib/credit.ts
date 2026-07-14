import "server-only";
import type { Client, CreditState } from "@/src/types";
import { fetchClientOrdersForCredit } from "@/src/lib/supabase/admin";

const CREDIT_STATUSES = new Set([
  "confirmed_waiting_payment",
  "delivering",
  "completed",
]);

function daysBetween(isoFrom: string, isoTo: string): number {
  return Math.floor((Date.parse(isoTo) - Date.parse(isoFrom)) / 86_400_000);
}

export async function getCreditState(client: Client): Promise<CreditState> {
  const today = new Date().toISOString().slice(0, 10);
  const orders = await fetchClientOrdersForCredit(client.id);

  const unpaid = orders.filter(
    (o) => CREDIT_STATUSES.has(o.status) && o.payment_status !== "paid",
  );

  const used = unpaid.reduce((s, o) => s + Number(o.total_amount), 0);

  const overdueOrders = unpaid.filter((o) => o.due_date != null && o.due_date < today);
  const overdue = overdueOrders.reduce((s, o) => s + Number(o.total_amount), 0);
  const overdueDays = overdueOrders.length
    ? Math.max(...overdueOrders.map((o) => daysBetween(o.due_date!, today)))
    : 0;

  const upcomingDue = unpaid
    .filter((o) => o.due_date != null && o.due_date >= today)
    .sort((a, b) => a.due_date!.localeCompare(b.due_date!));
  const nextDueDate = upcomingDue[0]?.due_date ?? null;

  const available = Math.max(0, client.credit_limit - used);

  let status: CreditState["status"];
  if (client.status === "blocked" || overdueDays > client.grace_days) {
    status = "blocked";
  } else if (overdue > 0 || available <= 0) {
    status = "prepay_only";
  } else {
    status = "active";
  }

  return { limit: client.credit_limit, used, overdue, overdueDays, available, nextDueDate, status };
}

export type OrderCheckResult = {
  allowed: boolean;
  requiresPrepay: boolean;
  reason?: string;
};

export async function canPlaceOrder(client: Client, orderSum: number): Promise<OrderCheckResult> {
  const state = await getCreditState(client);

  if (state.status === "blocked") {
    return {
      allowed: false,
      requiresPrepay: false,
      reason: "Отгрузки приостановлены до погашения просрочки",
    };
  }
  if (state.status === "prepay_only") {
    return { allowed: true, requiresPrepay: true, reason: "Необходима предоплата" };
  }
  if (orderSum > state.available) {
    return {
      allowed: true,
      requiresPrepay: true,
      reason: "Сумма превышает доступный кредит",
    };
  }
  return { allowed: true, requiresPrepay: false };
}
