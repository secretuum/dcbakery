import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import {
  fetchAdminOrder,
  fetchOrderByPaymentId,
  insertPaymentEvent,
  updateOrderPaymentStatus,
  updateOrderWhatsAppMessageId,
} from "@/src/lib/supabase/admin";
import {
  replaceWhatsAppOrderMessage,
  sendCustomerPaymentStatusNotification,
} from "@/src/lib/whatsapp";
import type { OrderStatus, PaymentProvider, PaymentStatus } from "@/src/types";

type PaymentWebhookBody = {
  amount?: number;
  eventId?: string;
  orderId?: string;
  orderNumber?: string;
  paymentId?: string;
  provider?: PaymentProvider;
  status?: string;
};

const paidStatuses = new Set(["paid", "success", "succeeded", "approved"]);
const failedStatuses = new Set(["failed", "error", "declined"]);
const expiredStatuses = new Set(["expired"]);
const refundedStatuses = new Set(["refunded", "refund"]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function asString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function asNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function parseWebhookBody(value: unknown): PaymentWebhookBody {
  if (!isRecord(value)) {
    return {};
  }

  return {
    amount: asNumber(value.amount ?? value.totalAmount),
    eventId: asString(value.eventId ?? value.event_id),
    orderId: asString(value.orderId ?? value.order_id),
    orderNumber: asString(value.orderNumber ?? value.order_number),
    paymentId: asString(value.paymentId ?? value.payment_id),
    provider: asString(value.provider) as PaymentProvider,
    status: asString(value.status ?? value.paymentStatus ?? value.payment_status),
  };
}

function normalizePaymentStatus(status?: string): PaymentStatus | null {
  const normalizedStatus = status?.toLowerCase();

  if (!normalizedStatus) {
    return null;
  }

  if (paidStatuses.has(normalizedStatus)) {
    return "paid";
  }

  if (failedStatuses.has(normalizedStatus)) {
    return "failed";
  }

  if (expiredStatuses.has(normalizedStatus)) {
    return "expired";
  }

  if (refundedStatuses.has(normalizedStatus)) {
    return "refunded";
  }

  return null;
}

function getOrderStatus(paymentStatus: PaymentStatus): OrderStatus | undefined {
  if (paymentStatus === "paid") {
    return "paid";
  }

  return undefined;
}

function isAuthorized(request: Request) {
  const webhookSecret = process.env.PAYMENT_WEBHOOK_SECRET;
  const incomingSecret =
    request.headers.get("x-payment-webhook-secret") ?? request.headers.get("x-webhook-secret");

  if (!webhookSecret || !incomingSecret) {
    return false;
  }

  const a = Buffer.from(incomingSecret, "utf8");
  const b = Buffer.from(webhookSecret, "utf8");
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function POST(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let rawPayload: unknown;

  try {
    rawPayload = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const body = parseWebhookBody(rawPayload);
  const paymentStatus = normalizePaymentStatus(body.status);

  if (!paymentStatus) {
    return NextResponse.json({ error: "Unsupported payment status" }, { status: 400 });
  }

  const order = body.orderId
    ? await fetchAdminOrder(body.orderId)
    : body.paymentId
      ? await fetchOrderByPaymentId(body.paymentId)
      : null;

  if (!order) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }

  if (body.provider === "manual" || order.payment_provider === "manual") {
    return NextResponse.json(
      { error: "Manual payments are processed only from admin" },
      { status: 400 },
    );
  }

  if (order.payment_status === "paid" || order.status === "paid") {
    return NextResponse.json({ error: "Payment already processed" }, { status: 409 });
  }

  if (order.status !== "confirmed_waiting_payment") {
    return NextResponse.json({ error: "Order not awaiting payment" }, { status: 409 });
  }

  await insertPaymentEvent({
    amount: body.amount ?? null,
    event_id: body.eventId || null,
    order_id: order.id,
    payment_id: body.paymentId || order.payment_id || null,
    provider: body.provider || order.payment_provider || null,
    raw_payload: rawPayload,
    status: paymentStatus,
  });

  if (body.amount !== undefined && Number(order.total_amount) !== body.amount) {
    const failedOrder = await updateOrderPaymentStatus(order.id, "failed");
    const [, managerMessageId] = await Promise.all([
      failedOrder
        ? sendCustomerPaymentStatusNotification(failedOrder, "failed").catch(() => null)
        : null,
      failedOrder
        ? replaceWhatsAppOrderMessage(failedOrder, order.whatsapp_message_id).catch(() => null)
        : null,
    ]);
    if (failedOrder && managerMessageId) {
      await updateOrderWhatsAppMessageId(failedOrder.id, managerMessageId).catch(
        () => undefined,
      );
    }
    return NextResponse.json({ error: "Amount mismatch" }, { status: 400 });
  }

  const updatedOrder = await updateOrderPaymentStatus(
    order.id,
    paymentStatus,
    getOrderStatus(paymentStatus),
  );
  const [managerMessageId] = await Promise.all([
    updatedOrder
      ? replaceWhatsAppOrderMessage(updatedOrder, order.whatsapp_message_id).catch(() => null)
      : null,
    updatedOrder
      ? sendCustomerPaymentStatusNotification(updatedOrder, paymentStatus).catch(() => null)
      : null,
  ]);

  if (updatedOrder && managerMessageId) {
    await updateOrderWhatsAppMessageId(updatedOrder.id, managerMessageId).catch(() => undefined);
  }

  return NextResponse.json({
    ok: true,
    order: updatedOrder,
  });
}
