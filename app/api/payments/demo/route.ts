import { NextResponse } from "next/server";
import {
  fetchAdminOrder,
  insertPaymentEvent,
  updateOrderPaymentStatus,
  updateOrderWhatsAppMessageId,
} from "@/src/lib/supabase/admin";
import { isDemoPaymentMode } from "@/src/lib/payments";
import { checkRateLimit, getRequestIdentifier } from "@/src/lib/rate-limit";
import { replaceWhatsAppOrderMessage } from "@/src/lib/whatsapp";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export async function POST(request: Request) {
  if (!isDemoPaymentMode()) {
    return NextResponse.json({ error: "Demo payments are disabled" }, { status: 404 });
  }

  const rateLimit = checkRateLimit({
    identifier: getRequestIdentifier(request),
    limit: 10,
    namespace: "payments:demo",
    windowMs: 10 * 60 * 1000,
  });

  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: "Too many demo payment attempts" },
      {
        status: 429,
        headers: { "Retry-After": String(rateLimit.retryAfterSeconds) },
      },
    );
  }

  let payload: unknown;

  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!isRecord(payload)) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const orderId = typeof payload.orderId === "string" ? payload.orderId : "";
  const paymentId = typeof payload.paymentId === "string" ? payload.paymentId : "";
  const order = orderId ? await fetchAdminOrder(orderId) : null;

  if (!order) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }

  if (
    !paymentId.startsWith("demo-") ||
    order.payment_id !== paymentId ||
    order.payment_provider !== "manual"
  ) {
    return NextResponse.json({ error: "Invalid demo payment" }, { status: 400 });
  }

  if (order.payment_status === "paid" || order.status === "paid") {
    return NextResponse.json({ ok: true, order });
  }

  if (order.status !== "confirmed_waiting_payment") {
    return NextResponse.json({ error: "Order is not awaiting payment" }, { status: 409 });
  }

  await insertPaymentEvent({
    amount: Number(order.total_amount),
    event_id: `demo-${crypto.randomUUID()}`,
    order_id: order.id,
    payment_id: paymentId,
    provider: "manual",
    raw_payload: {
      mode: "demo",
      paymentId,
    },
    status: "paid",
  });

  const paidOrder = await updateOrderPaymentStatus(order.id, "paid", "paid");
  const managerMessageId = paidOrder
    ? await replaceWhatsAppOrderMessage(paidOrder, order.whatsapp_message_id).catch(() => null)
    : null;

  if (paidOrder && managerMessageId) {
    await updateOrderWhatsAppMessageId(paidOrder.id, managerMessageId).catch(() => undefined);
  }

  return NextResponse.json({ ok: true, order: paidOrder });
}
