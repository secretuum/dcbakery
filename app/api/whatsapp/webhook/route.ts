import { NextResponse } from "next/server";
import {
  cancelOrder,
  clearProductStop,
  confirmAdminOrder,
  fetchAppSettings,
  fetchAdminOrderByNumber,
  fetchAdminOrderByWhatsAppMessageId,
  markOrderPaid,
  putProductOnStop,
  upsertCatalogProductOverride,
  updateOrderWhatsAppMessageId,
} from "@/src/lib/supabase/admin";
import { fetchAdminProducts } from "@/src/lib/catalog";
import { createPaymentLink } from "@/src/lib/payments";
import {
  handleWhatsAppCustomerMessage,
  isCustomerWhatsAppChat,
  resolveWhatsAppProductFromText,
} from "@/src/lib/whatsapp-catalog";
import {
  replaceWhatsAppOrderMessage,
  sendGreenApiTextMessage,
  sendCustomerDetailsRequestNotification,
  sendCustomerOrderCanceledNotification,
} from "@/src/lib/whatsapp";
import type { Order } from "@/src/types";

type WhatsAppCommand = "cancel" | "confirm" | "help" | "mark_paid" | "status";

type StockUpdateCommand = {
  productText: string;
  stockQty: number;
};

type StopListCommand = {
  action: "clear" | "put";
  productText: string;
  reason?: string | null;
};

type ParsedCommand = {
  action: WhatsAppCommand;
  orderNumber?: string;
};

const recentMissingOrderFeedback = new Map<string, number>();
const missingOrderFeedbackTtlMs = 5 * 60 * 1000;

const orderNumberPattern = /\bDCB-\d{4}-\d{4,10}\b/i;
const confirmCommandAliases = [
  "+",
  "confirm",
  "ok",
  "подтвердить",
  "подтверждаю",
  "подтвержден",
  "подтверждено",
  "ок",
] as const;
const markPaidCommandAliases = [
  "mark paid",
  "paid",
  "оплатил",
  "оплатила",
  "оплатили",
  "оплачено",
  "оплачен",
  "оплата пришла",
  "платеж пришел",
] as const;
const statusCommandAliases = ["status", "обновить", "статус"] as const;
const cancelCommandAliases = ["cancel", "отмена", "отменить", "отмени"] as const;
const helpCommandAliases = ["help", "commands", "команды", "помощь"] as const;

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
  const authorizationHeader = request.headers.get("authorization")?.trim();
  const incomingSecret =
    request.headers.get("x-whatsapp-webhook-secret") ??
    request.headers.get("x-webhook-secret") ??
    new URL(request.url).searchParams.get("secret");

  if (!webhookSecret) {
    return false;
  }

  return (
    incomingSecret === webhookSecret ||
    authorizationHeader === webhookSecret ||
    authorizationHeader === `Bearer ${webhookSecret}`
  );
}

function getBooleanEnv(name: string, defaultValue = true) {
  const value = process.env[name]?.trim().toLowerCase();

  if (!value) {
    return defaultValue;
  }

  return !["0", "false", "off", "no", "нет", "выкл"].includes(value);
}

function parseBooleanFlag(value: string | null | undefined, defaultValue = true) {
  if (!value) {
    return defaultValue;
  }

  return !["0", "false", "off", "no", "нет", "выкл"].includes(value.trim().toLowerCase());
}

async function getWhatsAppFeatureFlags() {
  const settings = await fetchAppSettings().catch((error) => {
    console.warn("[whatsapp:webhook] Failed to fetch runtime settings, using env:", error);
    return [];
  });
  const values = new Map(settings.map((setting) => [setting.key, setting.value]));

  return {
    botEnabled: parseBooleanFlag(
      values.get("whatsapp_bot_enabled"),
      getBooleanEnv("WHATSAPP_BOT_ENABLED", true),
    ),
    customerBotEnabled: parseBooleanFlag(
      values.get("whatsapp_customer_bot_enabled"),
      getBooleanEnv("WHATSAPP_CUSTOMER_BOT_ENABLED", true),
    ),
    managerCommandsEnabled: parseBooleanFlag(
      values.get("whatsapp_manager_commands_enabled"),
      getBooleanEnv("WHATSAPP_MANAGER_COMMANDS_ENABLED", true),
    ),
  };
}

function formatChatForLog(chatId: string) {
  if (!chatId) {
    return "missing";
  }

  const [leftPart, rightPart] = chatId.split("@");

  if (!leftPart || !rightPart) {
    return "malformed";
  }

  return `${leftPart.slice(0, 3)}***${leftPart.slice(-3)}@${rightPart}`;
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

function extractSenderName(payload: unknown) {
  return (
    readNestedString(payload, ["senderData", "senderName"]) ||
    readNestedString(payload, ["senderName"])
  );
}

function extractRelatedMessageIds(payload: unknown) {
  return [
    readNestedString(payload, ["messageData", "extendedTextMessageData", "stanzaId"]),
    readNestedString(payload, ["messageData", "extendedTextMessageData", "quotedMessageId"]),
    readNestedString(payload, ["messageData", "textMessageData", "stanzaId"]),
    readNestedString(payload, ["messageData", "quotedMessage", "stanzaId"]),
    readNestedString(payload, ["quotedMessage", "stanzaId"]),
    readNestedString(payload, ["stanzaId"]),
  ].filter(Boolean);
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function normalizeCommandText(text: string) {
  return text.toLowerCase().replace(/ё/g, "е").replace(orderNumberPattern, " ").trim();
}

function shouldSendMissingOrderFeedback(chatId: string, text: string) {
  const now = Date.now();
  const key = `${chatId}:${normalizeCommandText(text)}`;
  const lastSentAt = recentMissingOrderFeedback.get(key);

  for (const [feedbackKey, sentAt] of recentMissingOrderFeedback.entries()) {
    if (now - sentAt > missingOrderFeedbackTtlMs) {
      recentMissingOrderFeedback.delete(feedbackKey);
    }
  }

  if (lastSentAt && now - lastSentAt < missingOrderFeedbackTtlMs) {
    return false;
  }

  recentMissingOrderFeedback.set(key, now);
  return true;
}

function hasCommandAlias(text: string, aliases: readonly string[]) {
  return aliases.some((alias) => {
    const normalizedAlias = normalizeCommandText(alias);
    const escapedAlias = escapeRegExp(normalizedAlias);
    const pattern = new RegExp(`(^|[^\\p{L}\\p{N}])${escapedAlias}($|[^\\p{L}\\p{N}])`, "u");

    return pattern.test(text);
  });
}

function parseCommand(text: string): ParsedCommand | null {
  const orderNumber = text.match(orderNumberPattern)?.[0]?.toUpperCase();
  const normalizedText = normalizeCommandText(text);

  if (hasCommandAlias(normalizedText, helpCommandAliases)) {
    return {
      action: "help",
      orderNumber,
    };
  }

  if (hasCommandAlias(normalizedText, confirmCommandAliases)) {
    return {
      action: "confirm",
      orderNumber,
    };
  }

  if (hasCommandAlias(normalizedText, markPaidCommandAliases)) {
    return {
      action: "mark_paid",
      orderNumber,
    };
  }

  if (hasCommandAlias(normalizedText, cancelCommandAliases)) {
    return {
      action: "cancel",
      orderNumber,
    };
  }

  if (hasCommandAlias(normalizedText, statusCommandAliases)) {
    return {
      action: "status",
      orderNumber,
    };
  }

  return null;
}

function parseStockUpdateCommand(text: string): StockUpdateCommand | null {
  const normalizedText = normalizeCommandText(text);

  if (!/(остат|осталось|наличие|в наличии)/u.test(normalizedText)) {
    return null;
  }

  const patterns = [
    /^\s*(?:поставь|поставить|обнови|обновить|измени|изменить)?\s*(?:остаток|остатки|остатка|наличие|в наличии)\s+(.+?)\s*(?:=|:)?\s+(\d+(?:[.,]\d+)?)(?:\s|$)/u,
    /^\s*(.+?)\s+(?:остаток|остатки|остатка|осталось|наличие|в наличии)\s*(?:=|:)?\s*(\d+(?:[.,]\d+)?)(?:\s|$)/u,
  ];

  for (const pattern of patterns) {
    const match = normalizedText.match(pattern);

    if (!match) {
      continue;
    }

    const stockQty = Number(match[2].replace(",", "."));
    const productText = match[1]
      .replace(/^(у|по|для|товар|позиция)\s+/u, "")
      .replace(/\s+(шт|штук|кг|грамм|гр|ед)$/u, "")
      .trim();

    if (productText && Number.isFinite(stockQty) && stockQty >= 0) {
      return {
        productText,
        stockQty,
      };
    }
  }

  return null;
}

async function handleStockUpdateFromWhatsApp(chatId: string, text: string) {
  const stockUpdate = parseStockUpdateCommand(text);

  if (!stockUpdate) {
    return null;
  }

  const products = await fetchAdminProducts();
  const product = resolveWhatsAppProductFromText(stockUpdate.productText, products);

  if (!product) {
    const messageId = await sendGreenApiTextMessage(
      chatId,
      [
        "*DC Bakery: товар для остатка не найден*",
        "",
        `Не распознал: ${stockUpdate.productText}`,
        "",
        "Примеры:",
        "Шу с персиком остаток 10",
        "Остаток Наполеон 25",
      ].join("\n"),
    ).catch(() => null);

    return {
      action: "stock_update_not_found",
      messageId,
      ok: false,
    };
  }

  await upsertCatalogProductOverride(product.id, {
    stock_qty: stockUpdate.stockQty,
  });

  const messageId = await sendGreenApiTextMessage(
    chatId,
    [
      "*DC Bakery: остаток обновлен*",
      "",
      `${product.name}: ${stockUpdate.stockQty} ${product.unit}`,
      "",
      "Это сразу влияет на сайт и WhatsApp-каталог.",
    ].join("\n"),
  ).catch(() => null);

  return {
    action: "stock_updated",
    messageId,
    ok: true,
    productId: product.id,
    stockQty: stockUpdate.stockQty,
  };
}

function parseStopListCommand(text: string): StopListCommand | null {
  const normalizedText = normalizeCommandText(text);

  if (/(снять|убрать|вернуть|снова|доступн|в продаже)/u.test(normalizedText) && /стоп/u.test(normalizedText)) {
    const productText = normalizedText
      .replace(/стоп[\s-]?лист/u, " ")
      .replace(/(снять|убрать|вернуть|со стопа|из стопа|стоп|снова в продаже|в продаже|доступно|доступен|доступна)/gu, " ")
      .replace(/\s+/g, " ")
      .trim();

    return productText ? { action: "clear", productText } : null;
  }

  if (!/(стоп[\s-]?лист|стопе|на стоп|стопнуть|стоп)/u.test(normalizedText)) {
    return null;
  }

  const productText = normalizedText
    .replace(/^(обновление|обновить|добавить|добавь|позиция|товар)\s+/u, "")
    .replace(/стоп[\s-]?лист/u, " ")
    .replace(/(на стопе|на стоп|стопнуть|стоп)/gu, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!productText) {
    return null;
  }

  return {
    action: "put",
    productText,
    reason: text,
  };
}

async function handleStopListFromWhatsApp(chatId: string, text: string) {
  const command = parseStopListCommand(text);

  if (!command) {
    return null;
  }

  const products = await fetchAdminProducts();
  const product = resolveWhatsAppProductFromText(command.productText, products);

  if (!product) {
    const messageId = await sendGreenApiTextMessage(
      chatId,
      [
        "*DC Bakery: товар для стоп-листа не найден*",
        "",
        `Не распознал: ${command.productText}`,
        "",
        "Примеры:",
        "Наполеон на стопе",
        "снять стоп Наполеон",
      ].join("\n"),
    ).catch(() => null);

    return {
      action: "stop_list_not_found",
      messageId,
      ok: false,
    };
  }

  if (command.action === "clear") {
    await clearProductStop(product.id);

    const messageId = await sendGreenApiTextMessage(
      chatId,
      [
        "*DC Bakery: стоп снят*",
        "",
        `${product.name} снова доступен в каталоге.`,
      ].join("\n"),
    ).catch(() => null);

    return {
      action: "stop_list_cleared",
      messageId,
      ok: true,
      productId: product.id,
    };
  }

  await putProductOnStop({
    productId: product.id,
    productName: product.name,
    reason: command.reason,
    reportedByChatId: chatId,
    source: "whatsapp",
  });

  const messageId = await sendGreenApiTextMessage(
    chatId,
    [
      "*DC Bakery: товар поставлен на стоп*",
      "",
      `${product.name} скрыт с сайта и WhatsApp-каталога.`,
      "",
      "Чтобы вернуть: снять стоп " + product.name,
    ].join("\n"),
  ).catch(() => null);

  return {
    action: "stop_list_put",
    messageId,
    ok: true,
    productId: product.id,
  };
}

function formatCommandHelpMessage(orderNumber = "DCB-2026-123456") {
  return [
    "*DC Bakery: команды менеджера*",
    "",
    "Можно писать команду с номером заявки:",
    `${orderNumber} подтвердить`,
    `${orderNumber} оплачено`,
    `${orderNumber} отменить причина`,
    `${orderNumber} статус`,
    "",
    "Или ответить на сообщение заявки одним словом:",
    "подтвердить / оплачено / статус",
    "",
    "Короткие варианты:",
    "ок или + = подтвердить",
    "paid = отметить оплату",
    "",
    "Остатки:",
    "Шу с персиком остаток 10",
    "Остаток Наполеон 25",
    "",
    "Стоп-лист:",
    "Наполеон на стопе",
    "снять стоп Наполеон",
    "",
    "Временное отключение:",
    "WHATSAPP_BOT_ENABLED=false отключит нашу логику, но webhook продолжит отвечать.",
    "help / помощь / команды = эта подсказка",
  ].join("\n");
}

function formatOrderNotFoundMessage(orderNumber?: string) {
  return [
    "*DC Bakery: заявку не нашел*",
    "",
    orderNumber ? `Номер из команды: ${orderNumber}` : "В команде нет номера заявки.",
    "",
    "Напишите команду вместе с номером заявки:",
    "DCB-2026-123456 статус",
    "",
    "Или ответьте командой прямо на сообщение нужной заявки.",
  ].join("\n");
}

async function resolveOrderForCommand(command: ParsedCommand, relatedMessageIds: string[]) {
  if (command.orderNumber) {
    return fetchAdminOrderByNumber(command.orderNumber);
  }

  for (const messageId of relatedMessageIds) {
    const order = await fetchAdminOrderByWhatsAppMessageId(messageId);

    if (order) {
      return order;
    }
  }

  return null;
}

function getPaymentOrigin(request: Request) {
  return (process.env.NEXT_PUBLIC_SITE_URL ?? new URL(request.url).origin).replace(/\/$/, "");
}

async function forwardWebhookPayload(payload: unknown, request: Request) {
  const forwardUrl = process.env.GREEN_API_FORWARD_WEBHOOK_URL?.trim();

  if (!forwardUrl) {
    return false;
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 5000);
  const authorizationHeader = request.headers.get("authorization");
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  if (authorizationHeader) {
    headers.authorization = authorizationHeader;
  }

  try {
    const response = await fetch(forwardUrl, {
      method: "POST",
      headers,
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
  const customerMessageId = await sendCustomerDetailsRequestNotification(
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

function extractCancelReason(text: string, orderNumber?: string) {
  return normalizeCommandText(text)
    .replace(orderNumber ? normalizeCommandText(orderNumber) : "", "")
    .replace(/cancel|отмена|отменить|отмени/giu, "")
    .trim();
}

async function cancelOrderFromWhatsApp(order: Order, text: string) {
  if (order.payment_status === "paid" || order.status === "paid") {
    const managerMessageId = await publishManagerUpdate(order, order.whatsapp_message_id);
    return { action: "cancel", managerMessageId, order, skipped: true };
  }

  if (order.status === "canceled" || order.status === "cancelled" || order.status === "completed") {
    const managerMessageId = await publishManagerUpdate(order, order.whatsapp_message_id);
    return { action: "cancel", managerMessageId, order, skipped: true };
  }

  const canceledOrder = await cancelOrder(
    order.id,
    "manager",
    extractCancelReason(text, order.order_number) || null,
  );
  const managerMessageId = canceledOrder
    ? await publishManagerUpdate(canceledOrder, order.whatsapp_message_id)
    : null;

  if (canceledOrder) {
    await sendCustomerOrderCanceledNotification(canceledOrder).catch(() => null);
  }

  return {
    action: "cancel",
    managerMessageId,
    order: canceledOrder,
  };
}

export async function POST(request: Request) {
  if (!isAuthorized(request)) {
    console.warn("[whatsapp:webhook] unauthorized", {
      hasAuthorization: Boolean(request.headers.get("authorization")),
      hasQuerySecret: Boolean(new URL(request.url).searchParams.get("secret")),
      hasWebhookSecret: Boolean(process.env.WHATSAPP_WEBHOOK_SECRET),
    });

    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let payload: unknown;

  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const forwarded = await forwardWebhookPayload(payload, request);
  const respondWithIgnored = (reason: string) =>
    NextResponse.json({
      forwarded,
      ignored: true,
      reason,
    });

  const typeWebhook = readNestedString(payload, ["typeWebhook"]);
  const chatId = extractChatId(payload);
  const expectedChatId = process.env.GREEN_API_CHAT_ID;
  const text = extractText(payload);
  const featureFlags = await getWhatsAppFeatureFlags();

  console.info("[whatsapp:webhook] received", {
    chat: formatChatForLog(chatId),
    hasText: Boolean(text),
    isCustomerChat: isCustomerWhatsAppChat(chatId),
    isManagerChat: chatId === expectedChatId,
    typeWebhook: typeWebhook || "missing",
  });

  if (typeWebhook && typeWebhook !== "incomingMessageReceived") {
    return respondWithIgnored("Unsupported webhook type");
  }

  if (!expectedChatId) {
    console.error("[whatsapp:webhook] GREEN_API_CHAT_ID is not configured");

    return NextResponse.json({ error: "GREEN_API_CHAT_ID is not configured" }, { status: 503 });
  }

  if (!chatId) {
    return respondWithIgnored("Missing chatId");
  }

  if (!featureFlags.botEnabled) {
    return respondWithIgnored("WhatsApp bot disabled");
  }

  if (chatId !== expectedChatId) {
    if (!isCustomerWhatsAppChat(chatId)) {
      return respondWithIgnored("Not a manager or customer chat");
    }

    if (!featureFlags.customerBotEnabled) {
      return respondWithIgnored("WhatsApp customer bot disabled");
    }

    try {
      const result = await handleWhatsAppCustomerMessage({
        chatId,
        senderName: extractSenderName(payload),
        text,
      });

      return NextResponse.json({ forwarded, ...result });
    } catch (error) {
      console.error("[whatsapp] Customer webhook failed:", error);

      return NextResponse.json({
        forwarded,
        ignored: false,
        ok: false,
        reason: "Customer webhook failed",
      });
    }
  }

  if (!featureFlags.managerCommandsEnabled) {
    return respondWithIgnored("WhatsApp manager commands disabled");
  }

  const stopListResult = await handleStopListFromWhatsApp(chatId, text);

  if (stopListResult) {
    return NextResponse.json({ forwarded, ...stopListResult });
  }

  const stockUpdateResult = await handleStockUpdateFromWhatsApp(chatId, text);

  if (stockUpdateResult) {
    return NextResponse.json({ forwarded, ...stockUpdateResult });
  }

  const relatedMessageIds = extractRelatedMessageIds(payload);
  const command = parseCommand(text);

  if (!command) {
    return NextResponse.json({ forwarded, ignored: true, reason: "No command" });
  }

  if (command.action === "help") {
    const helpMessageId = await sendGreenApiTextMessage(
      chatId,
      formatCommandHelpMessage(command.orderNumber),
    ).catch(() => null);

    return NextResponse.json({ action: "help", forwarded, helpMessageId, ok: true });
  }

  const order = await resolveOrderForCommand(command, relatedMessageIds);

  if (!order) {
    const feedbackMessageId = shouldSendMissingOrderFeedback(chatId, text)
      ? await sendGreenApiTextMessage(chatId, formatOrderNotFoundMessage(command.orderNumber)).catch(
          () => null,
        )
      : null;

    return NextResponse.json(
      {
        error: "Order not found",
        feedbackMessageId,
        hint: "Send order number with command or reply to the order message",
      },
    );
  }

  if (command.action === "confirm") {
    const result = await confirmOrderFromWhatsApp(order, request);
    return NextResponse.json({ ok: true, ...result });
  }

  if (command.action === "mark_paid") {
    const result = await markPaidFromWhatsApp(order);
    return NextResponse.json({ ok: true, ...result });
  }

  if (command.action === "cancel") {
    const result = await cancelOrderFromWhatsApp(order, text);
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
