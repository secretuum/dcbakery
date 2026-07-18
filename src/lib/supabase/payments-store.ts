import "server-only";
import type { Order } from "@/src/types";

// Попытки платежа (таблица payments) — подготовка к Halyk ePay.
// Отдельный модуль: запросы к БД намеренно не добавляются в admin.ts.

export type PaymentAttemptStatus =
  | "created"
  | "pending"
  | "paid"
  | "failed"
  | "expired"
  | "canceled"
  | "refunded";

export type PaymentAttempt = {
  id: string;
  order_id: string;
  provider: "halyk" | "freedom" | "manual" | "kaspi_later";
  invoice_id: number;
  amount: number;
  currency: string;
  status: PaymentAttemptStatus;
  external_id: string | null;
  secret_hash: string | null;
  failure_reason: string | null;
  created_at: string;
  paid_at: string | null;
  expires_at: string | null;
  refunded_amount: number | null;
};

function getConfig() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Supabase admin credentials are not configured");
  }

  return { restUrl: `${supabaseUrl.replace(/\/$/, "")}/rest/v1`, serviceRoleKey };
}

function headers(serviceRoleKey: string, representation = true) {
  return {
    apikey: serviceRoleKey,
    Authorization: `Bearer ${serviceRoleKey}`,
    "Content-Type": "application/json",
    Prefer: representation ? "return=representation" : "return=minimal",
  };
}

async function expectOk(response: Response, action: string) {
  if (!response.ok) {
    throw new Error(`${action}: ${response.status} ${await response.text()}`);
  }
}

/** Активная (незавершённая) попытка по заказу, свежая сверху. */
export async function getActivePaymentAttempt(orderId: string): Promise<PaymentAttempt | null> {
  const { restUrl, serviceRoleKey } = getConfig();
  const params = new URLSearchParams({
    order_id: `eq.${orderId}`,
    status: "in.(created,pending)",
    order: "created_at.desc",
    limit: "1",
  });
  const response = await fetch(`${restUrl}/payments?${params}`, {
    headers: headers(serviceRoleKey),
    cache: "no-store",
  });
  await expectOk(response, "Failed to load payment attempt");
  const [attempt] = (await response.json()) as PaymentAttempt[];
  return attempt ?? null;
}

export async function findPaymentByInvoiceId(invoiceId: string | number): Promise<PaymentAttempt | null> {
  const { restUrl, serviceRoleKey } = getConfig();
  const params = new URLSearchParams({ invoice_id: `eq.${invoiceId}`, limit: "1" });
  const response = await fetch(`${restUrl}/payments?${params}`, {
    headers: headers(serviceRoleKey),
    cache: "no-store",
  });
  await expectOk(response, "Failed to find payment");
  const [attempt] = (await response.json()) as PaymentAttempt[];
  return attempt ?? null;
}

/**
 * Возвращает активную попытку либо создаёт новую (при смене суммы заказа
 * старая попытка гасится — у Halyk номер уникален на каждую операцию).
 */
export async function getOrCreatePaymentAttempt(
  order: Order,
  provider: PaymentAttempt["provider"],
  secretHash?: string,
  ttlMinutes = 60,
): Promise<PaymentAttempt> {
  const active = await getActivePaymentAttempt(order.id);

  if (active && Number(active.amount) === Number(order.total_amount) && active.provider === provider) {
    return active;
  }

  if (active) {
    await updatePaymentAttempt(active.id, {
      status: "canceled",
      failure_reason: "superseded: order amount or provider changed",
    });
  }

  const { restUrl, serviceRoleKey } = getConfig();
  const expiresAt = new Date(Date.now() + ttlMinutes * 60 * 1000).toISOString();
  const response = await fetch(`${restUrl}/payments`, {
    method: "POST",
    headers: headers(serviceRoleKey),
    body: JSON.stringify({
      amount: order.total_amount,
      currency: "KZT",
      expires_at: expiresAt,
      order_id: order.id,
      provider,
      secret_hash: secretHash || null,
      status: "created",
    }),
    cache: "no-store",
  });
  await expectOk(response, "Failed to create payment attempt");
  const [attempt] = (await response.json()) as PaymentAttempt[];

  if (!attempt) {
    throw new Error("Payment attempt was not created");
  }

  return attempt;
}

export async function updatePaymentAttempt(
  paymentId: string,
  patch: Partial<
    Pick<
      PaymentAttempt,
      "status" | "external_id" | "failure_reason" | "paid_at" | "refunded_amount"
    >
  >,
): Promise<PaymentAttempt | null> {
  const { restUrl, serviceRoleKey } = getConfig();
  const params = new URLSearchParams({ id: `eq.${paymentId}` });
  const response = await fetch(`${restUrl}/payments?${params}`, {
    method: "PATCH",
    headers: headers(serviceRoleKey),
    body: JSON.stringify(patch),
    cache: "no-store",
  });
  await expectOk(response, "Failed to update payment attempt");
  const [attempt] = (await response.json()) as PaymentAttempt[];
  return attempt ?? null;
}

/** Атомарный перевод попытки в paid: сработает только один раз. */
export async function markPaymentAttemptPaid(paymentId: string): Promise<PaymentAttempt | null> {
  const { restUrl, serviceRoleKey } = getConfig();
  const params = new URLSearchParams({
    id: `eq.${paymentId}`,
    status: "in.(created,pending)",
  });
  const response = await fetch(`${restUrl}/payments?${params}`, {
    method: "PATCH",
    headers: headers(serviceRoleKey),
    body: JSON.stringify({ paid_at: new Date().toISOString(), status: "paid" }),
    cache: "no-store",
  });
  await expectOk(response, "Failed to mark payment paid");
  const [attempt] = (await response.json()) as PaymentAttempt[];
  return attempt ?? null;
}

/** Незавершённые попытки для фоновой сверки статусов. */
export async function listUnsettledPayments(olderThanMinutes = 5, limit = 50): Promise<PaymentAttempt[]> {
  const { restUrl, serviceRoleKey } = getConfig();
  const threshold = new Date(Date.now() - olderThanMinutes * 60 * 1000).toISOString();
  const params = new URLSearchParams({
    status: "in.(created,pending)",
    provider: "eq.halyk",
    created_at: `lt.${threshold}`,
    order: "created_at.asc",
    limit: String(limit),
  });
  const response = await fetch(`${restUrl}/payments?${params}`, {
    headers: headers(serviceRoleKey),
    cache: "no-store",
  });
  await expectOk(response, "Failed to list unsettled payments");
  return (await response.json()) as PaymentAttempt[];
}
