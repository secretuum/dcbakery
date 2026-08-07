import "server-only";
import type { Client, CreditState } from "@/src/types";
import { fetchClientOrdersForCredit } from "@/src/lib/supabase/admin";
import { orderTotalWithDelivery } from "@/app/constants";

/** Ставка пени за просрочку оплаты (оферта §11.2): 1% в день. */
const PENALTY_RATE_PER_DAY = 0.01;

// Статусы, при которых неоплаченный заказ = долг по консигнации (тратит лимит,
// копит просрочку/пеню). in_progress включён: по новому флоу менеджер берёт заказ
// в работу ДО оплаты — иначе такой долг был бы невидим для лимита.
const CREDIT_STATUSES = new Set([
  "confirmed_waiting_payment",
  "overdue",
  "in_progress",
  "delivering",
  "completed",
]);

function daysBetween(isoFrom: string, isoTo: string): number {
  return Math.floor((Date.parse(isoTo) - Date.parse(isoFrom)) / 86_400_000);
}

/** Сегодняшняя дата по Алматы (UTC+5, без переходов) — иначе ночью 00:00–05:00
 * просрочка/пеня отставали бы на сутки (UTC-дата ещё «вчерашняя»). */
function almatyToday(): string {
  return new Date(Date.now() + 5 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

export async function getCreditState(client: Client): Promise<CreditState> {
  const today = almatyToday();
  const orders = await fetchClientOrdersForCredit(client.id);

  const unpaid = orders.filter(
    (o) => CREDIT_STATUSES.has(o.status) && o.payment_status !== "paid",
  );

  const used = unpaid.reduce((s, o) => s + Number(o.total_amount) + Number(o.delivery_amount ?? 0), 0);

  const overdueOrders = unpaid.filter((o) => o.due_date != null && o.due_date < today);
  const overdue = overdueOrders.reduce((s, o) => s + Number(o.total_amount) + Number(o.delivery_amount ?? 0), 0);
  const overdueDays = overdueOrders.length
    ? Math.max(...overdueOrders.map((o) => daysBetween(o.due_date!, today)))
    : 0;

  // Пеня (оферта §11.2): 1% в день от суммы каждого просроченного заказа за фактическое
  // число дней просрочки. Оценочно — точная сумма фиксируется актом сверки.
  const penalty = Math.round(
    overdueOrders.reduce(
      (s, o) => s + orderTotalWithDelivery(o) * PENALTY_RATE_PER_DAY * daysBetween(o.due_date!, today),
      0,
    ),
  );

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

  return {
    limit: client.credit_limit,
    used,
    overdue,
    overdueDays,
    available,
    nextDueDate,
    status,
    penalty,
    penaltyRatePct: PENALTY_RATE_PER_DAY * 100,
  };
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
      reason: "Сумма превышает доступный лимит",
    };
  }
  return { allowed: true, requiresPrepay: false };
}

/**
 * Срок оплаты по консигнации: индивидуальный срок клиента, иначе CONSIGNMENT_DAYS (7).
 * Отсчитывается от переданной даты (обычно — даты подтверждения). Единый источник для
 * канонического confirmOrder и подтверждения заказа через WhatsApp — чтобы они не
 * расходились (иначе WhatsApp-путь оставлял due_date=NULL и заказ не становился overdue).
 */
export function consignmentDueDate(
  client: Pick<Client, "payment_terms_days"> | null | undefined,
  fromDateIso: string,
): string {
  const termDays = client?.payment_terms_days ?? Number(process.env.CONSIGNMENT_DAYS ?? 7);
  const d = new Date(fromDateIso);
  d.setDate(d.getDate() + termDays);
  return d.toISOString().slice(0, 10);
}
