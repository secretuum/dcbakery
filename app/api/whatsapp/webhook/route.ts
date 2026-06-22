import { NextResponse } from "next/server";
import {
  confirmAdminOrder,
  fetchAdminOrderByNumber,
  markOrderPaid,
  updateOrderWhatsAppMessageId,
} from "@/src/lib/supabase/admin";
import { createPaymentLink } from "@/src/lib/payments";
import {
  replaceWhatsAppOrderMessage,
  sendCustomerPaymentLinkNotification,
} from "@/src/lib/whatsapp";
import type { Order } from "@/src/types";

type WhatsAppCommand = "confirm" | "mark_paid" | "status";

type ParsedCommand = {
  action: WhatsAppCommand;
  orderNumber: string;
};

const orderNumberPattern = /\bDCB-\d{4}-\d{4,10}\b/i;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function readString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function readNestedString(value: unknown, path: string[]) {
  let current: unknown = value;

  for (const key of path) {
    if (!isRecord(current)) {
      return "";
    }

    current = current[key];
  }

  return readString(current);
}

function isAuthorized(request: Request) {
  const webhookSecret = process.env.WHATSAPP_WEBHOOK_SECRET;
  const incomingSecret =
    request.headers.get("x-whatsapp-webhook-secret") ??
    request.headers.get("x-webhook-secret") ??
    new URL(request.url).searchParams.get("secret");

  if (!webhookSecret) {
    return false;
  }

  return incomingSecret === webhookSecret;
}

function extractChatId(payload: unknown) {
  return (
    readNestedString(payload, ["senderData", "chatId"]) ||
    readNestedString(payload, ["messageData", "chatId"]) ||
    readNestedString(payload, ["chatId"])
  );
}

function extractText(payload: unknown) {
  return (
    readNestedString(payload, ["messageData", "textMessageData", "textMessage"]) ||
    readNestedString(payload, ["messageData", "extendedTextMessageData", "text"]) ||
    readNestedString(payload, ["messageData", "text"]) ||
    readNestedString(payload, ["textMessage"]) ||
    readNestedString(payload, ["message"]) ||
    readNestedString(payload, ["text"])
  );
}

function parseCommand(text: string): ParsedCommand | null {
  const orderNumber = text.match(orderNumberPattern)?.[0]?.toUpperCase();
  const normalizedText = text.toLowerCase();

  if (!orderNumber) {
    return null;
  }

  if (normalizedText.includes("подтверд") || normalizedText.includes("confirm")) {
    return {
      action: "confirm",
      orderNumber,
    };
  }

  if (
    normalizedText.includes("оплачено") ||
    normalizedText.includes("оплачен") ||
    normalizedText.includes("оплатил") ||
    normalizedText.includes("paid")
  ) {
    return {
      action: "mark_paid",
      orderNumber,
    };
  }

  if (normalizedText.includes("статус") || normalizedText.includes("status")) {
    return {
      action: "status",
      orderNumber,
    };
  }

  return null;
}

function getPaymentOrigin(request: Request) {
  return (process.env.NEXT_PUBLIC_SITE_URL ?? new URL(request.url).origin).replace(/\/$/, "");
}

async function forwardWebhookPayload(payload: unknown) {
  const forwardUrl = process.env.GREEN_API_FORWARD_WEBHOOK_URL?.trim();

  if (!forwardUrl) {
    return false;
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 5000);

  try {
    const response = await fetch(forwardUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    if (!response.ok) {
      console.error("[whatsapp] Forward webhook error:", response.status, await response.text());
      return false;
    }

    return true;
  } catch (error) {
    console.error("[whatsapp] Forward webhook failed:", error);
    return false;
  } finally {
    clearTimeout(timeoutId);
  }
}

async function publishManagerUpdate(order: Order, previousMessageId?: string | null) {
  const managerMessageId = await replaceWhatsAppOrderMessage(order, previousMessageId).catch(
    () => null,
  );

  if (managerMessageId) {
    await updateOrderWhatsAppMessageId(order.id, managerMessageId).catch(() => undefined);
  }

  return managerMessageId;
}

async function confirmOrderFromWhatsApp(order: Order, request: Request) {
  if (
    order.status === "paid" ||
    order.status === "completed" ||
    order.status === "canceled" ||
    order.status === "cancelled"
  ) {
    const managerMessageId = await publishManagerUpdate(order, order.whatsapp_message_id);
    return { action: "confirm", managerMessageId, order, skipped: true };
  }

  const paymentLink = createPaymentLink(order, "manual", getPaymentOrigin(request));
  const customerMessageId = await sendCustomerPaymentLinkNotification(
    order,
    paymentLink.paymentUrl,
  ).catch(() => null);
  const now = new Date().toISOString();
  const confirmedOrder = await confirmAdminOrder(order.id, {
    confirmed_at: now,
    payment_id: paymentLink.paymentId,
    payment_link_sent_at: customerMessageId ? now : null,
    payment_provider: paymentLink.paymentProvider,
    payment_status: customerMessageId ? "payment_link_sent" : "payment_link_created",
    payment_url: paymentLink.paymentUrl,
    status: "confirmed_waiting_payment",
  });
  const managerMessageId = confirmedOrder
    ? await publishManagerUpdate(confirmedOrder, order.whatsapp_message_id)
    : null;

  return {
    action: "confirm",
    customerMessageId,
    managerMessageId,
    order: confirmedOrder,
  };
}

async function markPaidFromWhatsApp(order: Order) {
  if (order.status === "paid" || order.payment_status === "paid") {
    const managerMessageId = await publishManagerUpdate(order, order.whatsapp_message_id);
    return { action: "mark_paid", managerMessageId, order, skipped: true };
  }

  if (order.status === "canceled" || order.status === "cancelled" || order.status === "completed") {
    const managerMessageId = await publishManagerUpdate(order, order.whatsapp_message_id);
    return { action: "mark_paid", managerMessageId, order, skipped: true };
  }

  const paidOrder = await markOrderPaid(order.id);
  const managerMessageId = paidOrder
    ? await publishManagerUpdate(paidOrder, order.whatsapp_message_id)
    : null;

  return {
    action: "mark_paid",
    managerMessageId,
    order: paidOrder,
  };
}

export async function POST(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let payload: unknown;

  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const forwarded = await forwardWebhookPayload(payload);

  const typeWebhook = readNestedString(payload, ["typeWebhook"]);

  if (typeWebhook && typeWebhook !== "incomingMessageReceived") {
    return NextResponse.json({ forwarded, ignored: true, reason: "Unsupported webhook type" });
  }

  const chatId = extractChatId(payload);
  const expectedChatId = process.env.GREEN_API_CHAT_ID;

  if (!expectedChatId) {
    return NextResponse.json({ error: "GREEN_API_CHAT_ID is not configured" }, { status: 503 });
  }

  if (chatId !== expectedChatId) {
    return NextResponse.json({ error: "Forbidden chat" }, { status: 403 });
  }

  const text = extractText(payload);
  const command = parseCommand(text);

  if (!command) {
    return NextResponse.json({ forwarded, ignored: true, reason: "No command" });
  }

  const order = await fetchAdminOrderByNumber(command.orderNumber);

  if (!order) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }

  if (command.action === "confirm") {
    const result = await confirmOrderFromWhatsApp(order, request);
    return NextResponse.json({ ok: true, ...result });
  }

  if (command.action === "mark_paid") {
    const result = await markPaidFromWhatsApp(order);
    return NextResponse.json({ ok: true, ...result });
  }

  const managerMessageId = await publishManagerUpdate(order, order.whatsapp_message_id);

  return NextResponse.json({
    action: "status",
    managerMessageId,
    ok: true,
    order,
  });
}
