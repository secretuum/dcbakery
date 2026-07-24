import "server-only";
import type { Order, OrderItem } from "@/src/types";
import { formatPrice } from "@/src/lib/format";
import { normalizeKzPhone } from "@/src/lib/phone";
import { orderStatusLabels, paymentStatusLabels } from "@/src/lib/order-status";
import { formatResponsibleBlock } from "@/src/lib/responsibles";
import {
  fetchWhatsAppClientByChatId,
  isWhatsAppClientProfileComplete,
} from "@/src/lib/whatsapp-client-store";
import type { PaymentStatus } from "@/src/types";

type GreenApiSendResponse = {
  idMessage?: string;
};

function optional(value?: string | null) {
  return value?.trim() ? value : "не указано";
}

function formatOrderLine(item: OrderItem) {
  const total = item.price > 0 ? formatPrice(item.total_amount) : "Цена уточняется";
  return `- ${item.product_name} x ${item.qty} ${item.unit} = ${total}`;
}

function getGreenApiConfig() {
  const instanceId = process.env.GREEN_API_INSTANCE_ID;
  const apiToken = process.env.GREEN_API_TOKEN;

  if (!instanceId || !apiToken) {
    return null;
  }

  return {
    apiToken,
    instanceId,
  };
}

// Единый флаг «WhatsApp включён». По умолчанию ВЫКЛ (пивот на Telegram + кабинет).
// Клиентские пуши гейтятся на месте вызова (orders/actions), менеджерские —
// внутри sendWhatsAppNotification / replaceWhatsAppOrderMessage.
export function whatsappEnabled(): boolean {
  return process.env.WHATSAPP_ENABLED === "true";
}

// Узкий флаг: разовая рассылка клиенту при подтверждении (заказ + счёт по ссылке).
// Не зависит от общего whatsappEnabled — остальной WhatsApp (отмена, менеджерские
// карточки, интерактив) остаётся спящим. Клиент всё прочее смотрит на сайте.
export function whatsappClientNotifyEnabled(): boolean {
  return process.env.WHATSAPP_CLIENT_NOTIFY === "true";
}

function getManagerCommandBlock(order: Order) {
  return [
    "Команды менеджера в этом чате:",
    `${order.order_number} подтвердить`,
    `${order.order_number} оплачено`,
    `${order.order_number} статус`,
    "",
    "Или ответьте на сообщение заявки:",
    "подтвердить / оплачено / статус",
    "помощь = показать команды",
  ].join("\n");
}

function formatStatusBlock(order: Order) {
  const orderStatus = orderStatusLabels[order.status] ?? order.status;
  const paymentStatus = order.payment_status
    ? paymentStatusLabels[order.payment_status]
    : "не указано";

  return [
    `Статус заявки: *${orderStatus}*`,
    `Статус оплаты: *${paymentStatus}*`,
    order.payment_url ? `Ссылка оплаты: ${order.payment_url}` : null,
  ]
    .filter(Boolean)
    .join("\n");
}

export function formatWhatsAppNotification(order: Order, items: OrderItem[]) {
  const itemLines = items.map(formatOrderLine).join("\n");

  return [
    `*Новая заявка ${order.order_number}*`,
    "",
    formatStatusBlock(order),
    "",
    `Компания: ${order.company_name}`,
    `Контакт: ${order.customer_name} / ${order.customer_phone}`,
    `Адрес: ${optional(order.delivery_address)}`,
    `Дата: ${optional(order.delivery_date)} | Время: ${optional(order.delivery_time)}`,
    "--------------------",
    itemLines,
    "--------------------",
    formatResponsibleBlock(items),
    "--------------------",
    `Итого: *${formatPrice(order.total_amount)}*`,
    `Оплата: ${optional(order.payment_method)}`,
    order.comment ? `Комментарий: ${order.comment}` : null,
    "",
    getManagerCommandBlock(order),
  ]
    .filter(Boolean)
    .join("\n");
}

export function formatResponsibleDirectNotification(order: Order, items: OrderItem[]) {
  const itemLines = items.map(formatOrderLine).join("\n");

  return [
    `DC Bakery: вы указаны ответственным по заявке ${order.order_number}`,
    "",
    formatStatusBlock(order),
    "",
    `Компания: ${order.company_name}`,
    `Контакт: ${order.customer_name} / ${order.customer_phone}`,
    `Итого: *${formatPrice(order.total_amount)}*`,
    "--------------------",
    itemLines,
    "--------------------",
    "Команды можно писать в рабочем WhatsApp-чате:",
    `${order.order_number} подтвердить`,
    `${order.order_number} оплачено`,
    `${order.order_number} статус`,
    "Или ответом на сообщение заявки: подтвердить / оплачено / статус",
  ].join("\n");
}

export function formatWhatsAppOrderStatusNotification(order: Order) {
  return [
    `*Актуальный статус ${order.order_number}*`,
    "",
    formatStatusBlock(order),
    "",
    `Компания: ${order.company_name}`,
    `Контакт: ${order.customer_name} / ${order.customer_phone}`,
    `Итого: *${formatPrice(order.total_amount)}*`,
    "",
    getManagerCommandBlock(order),
  ].join("\n");
}

export async function sendGreenApiTextMessage(chatId: string, message: string) {
  const config = getGreenApiConfig();

  if (!config || !chatId) {
    return null;
  }

  const url = `https://api.green-api.com/waInstance${config.instanceId}/sendMessage/${config.apiToken}`;

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        chatId,
        message,
      }),
    });

    if (!response.ok) {
      console.error("[whatsapp] Green API error:", response.status, await response.text());
      return null;
    }

    const data = (await response.json()) as GreenApiSendResponse;
    return data.idMessage ?? null;
  } catch (error) {
    console.error("[whatsapp] sendGreenApiTextMessage failed:", error);
    return null;
  }
}

async function deleteGreenApiMessage(chatId: string, idMessage: string) {
  const config = getGreenApiConfig();

  if (!config || !chatId || !idMessage) {
    return false;
  }

  const url = `https://api.green-api.com/waInstance${config.instanceId}/deleteMessage/${config.apiToken}`;

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        chatId,
        idMessage,
      }),
    });

    if (!response.ok) {
      console.error("[whatsapp] deleteMessage error:", response.status, await response.text());
      return false;
    }

    return true;
  } catch (error) {
    console.error("[whatsapp] deleteGreenApiMessage failed:", error);
    return false;
  }
}

async function editGreenApiMessage(chatId: string, idMessage: string, message: string) {
  const config = getGreenApiConfig();

  if (!config || !chatId || !idMessage) {
    return false;
  }

  const url = `https://api.green-api.com/waInstance${config.instanceId}/editMessage/${config.apiToken}`;

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        chatId,
        idMessage,
        message,
      }),
    });

    if (!response.ok) {
      console.warn("[whatsapp] editMessage skipped:", response.status, await response.text());
      return false;
    }

    return true;
  } catch (error) {
    console.warn("[whatsapp] editGreenApiMessage failed:", error);
    return false;
  }
}

export async function sendWhatsAppNotification(order: Order, items: OrderItem[]) {
  if (!whatsappEnabled()) {
    return null;
  }

  const chatId = process.env.GREEN_API_CHAT_ID;

  if (!chatId) {
    return null;
  }

  const managerMessageId = await sendGreenApiTextMessage(chatId, formatWhatsAppNotification(order, items));

  return managerMessageId;
}

export async function replaceWhatsAppOrderMessage(order: Order, previousMessageId?: string | null) {
  if (!whatsappEnabled()) {
    return null;
  }

  const chatId = process.env.GREEN_API_CHAT_ID;

  if (!chatId) {
    return null;
  }

  const message = formatWhatsAppOrderStatusNotification(order);

  if (previousMessageId) {
    const edited = await editGreenApiMessage(chatId, previousMessageId, message);

    if (edited) {
      return previousMessageId;
    }
  }

  const nextMessageId = await sendGreenApiTextMessage(chatId, message);

  if (nextMessageId && previousMessageId && previousMessageId !== nextMessageId) {
    await deleteGreenApiMessage(chatId, previousMessageId).catch(() => false);
  }

  return nextMessageId;
}

export function getWhatsAppChatIdFromPhone(phone: string) {
  const digits = phone.replace(/\D/g, "");

  if (!digits) {
    return null;
  }

  const normalizedDigits = digits.startsWith("8") ? `7${digits.slice(1)}` : digits;
  return `${normalizedDigits}@c.us`;
}

type CheckWhatsappResponse = { existsWhatsapp?: boolean };

/** Есть ли WhatsApp на номере (Green API checkWhatsapp). true/false — определённый
 *  ответ; null — проверить нельзя (нет конфига / ошибка / таймаут), тогда
 *  вызывающий НЕ блокирует (fail-open). */
export async function checkWhatsappExists(phone: string): Promise<boolean | null> {
  const config = getGreenApiConfig();
  const phoneNumber = normalizeKzPhone(phone);
  if (!config || !phoneNumber) {
    return null;
  }

  const url = `https://api.green-api.com/waInstance${config.instanceId}/checkWhatsapp/${config.apiToken}`;
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phoneNumber: Number(phoneNumber) }),
      signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) {
      return null;
    }
    const data = (await response.json()) as CheckWhatsappResponse;
    return typeof data.existsWhatsapp === "boolean" ? data.existsWhatsapp : null;
  } catch {
    return null;
  }
}

export function formatPaymentLinkNotification(order: Order, paymentUrl: string) {
  return [
    "DC Bakery",
    "",
    `Ваш заказ №${order.order_number} подтвержден.`,
    "",
    `Сумма к оплате: ${formatPrice(order.total_amount)}`,
    "",
    "Счёт на оплату и документы — по ссылке:",
    paymentUrl,
    "",
    "Статус заказа и все обновления смотрите в личном кабинете на сайте.",
  ].join("\n");
}

export async function sendCustomerOrderConfirmationNotification(
  order: Order,
  paymentUrl: string,
) {
  const chatId = getWhatsAppChatIdFromPhone(order.customer_phone);

  if (!chatId) {
    return { messageId: null, registrationRequested: false };
  }

  const profile = await fetchWhatsAppClientByChatId(chatId).catch(() => null);
  const registrationRequested = !isWhatsAppClientProfileComplete(profile);
  const message = registrationRequested
    ? formatCustomerDetailsRequestNotification(order, paymentUrl)
    : formatPaymentLinkNotification(order, paymentUrl);
  const messageId = await sendGreenApiTextMessage(chatId, message);

  return { messageId, registrationRequested };
}

export async function sendCustomerPaymentLinkNotification(order: Order, paymentUrl: string) {
  const chatId = getWhatsAppChatIdFromPhone(order.customer_phone);

  if (!chatId) {
    return null;
  }

  return sendGreenApiTextMessage(chatId, formatPaymentLinkNotification(order, paymentUrl));
}

export function formatCustomerDetailsRequestNotification(order: Order, paymentUrl: string) {
  return [
    "DC Bakery",
    "",
    `Ваша заявка ${order.order_number} подтверждена менеджером.`,
    `Сумма к оплате: ${formatPrice(order.total_amount)}`,
    "",
    "Чтобы закрепить реквизиты и подготовить доставку, ответьте одним сообщением по шаблону:",
    "",
    "Компания:",
    "БИН/ИП:",
    "Контакт:",
    "Email:",
    "Адрес доставки:",
    "Дата доставки:",
    "Время доставки:",
    "Оплата: Выставить счет / Безналичный расчет",
    "Комментарий:",
    "",
    "Страница счета и документов:",
    paymentUrl,
    "",
    "Если часть данных уже отправляли, можно заполнить только то, что изменилось.",
  ].join("\n");
}

export async function sendCustomerDetailsRequestNotification(order: Order, paymentUrl: string) {
  const chatId = getWhatsAppChatIdFromPhone(order.customer_phone);

  if (!chatId) {
    return null;
  }

  return sendGreenApiTextMessage(
    chatId,
    formatCustomerDetailsRequestNotification(order, paymentUrl),
  );
}

export function formatCustomerPaymentStatusNotification(
  order: Order,
  paymentStatus: PaymentStatus,
) {
  if (paymentStatus === "paid") {
    return [
      "DC Bakery",
      "",
      `Оплата по заказу ${order.order_number} успешно получена.`,
      `Сумма: ${formatPrice(order.total_amount)}`,
      "",
      "Заказ передан в работу. Актуальный статус доступен на странице заказа:",
      order.payment_url,
    ]
      .filter(Boolean)
      .join("\n");
  }

  if (paymentStatus === "failed") {
    return [
      "DC Bakery",
      "",
      `Оплата по заказу ${order.order_number} не прошла.`,
      "Деньги не списаны. Откройте страницу заказа и попробуйте еще раз.",
      order.payment_url,
    ]
      .filter(Boolean)
      .join("\n");
  }

  if (paymentStatus === "refunded") {
    return [
      "DC Bakery",
      "",
      `По заказу ${order.order_number} зарегистрирован возврат.`,
      "Подробности уточнит менеджер.",
    ].join("\n");
  }

  return [
    "DC Bakery",
    "",
    `Статус оплаты заказа ${order.order_number}: ${paymentStatusLabels[paymentStatus]}.`,
    order.payment_url,
  ]
    .filter(Boolean)
    .join("\n");
}

export async function sendCustomerPaymentStatusNotification(
  order: Order,
  paymentStatus: PaymentStatus,
) {
  const chatId = getWhatsAppChatIdFromPhone(order.customer_phone);

  if (!chatId) {
    return null;
  }

  return sendGreenApiTextMessage(
    chatId,
    formatCustomerPaymentStatusNotification(order, paymentStatus),
  );
}

export function formatCustomerOrderCanceledNotification(order: Order) {
  return [
    "DC Bakery",
    "",
    `Заявка ${order.order_number} отменена.`,
    order.cancellation_reason ? `Причина: ${order.cancellation_reason}` : null,
    "",
    "Если нужно собрать новую заявку, напишите: каталог",
  ]
    .filter(Boolean)
    .join("\n");
}

export async function sendCustomerOrderCanceledNotification(order: Order) {
  const chatId = getWhatsAppChatIdFromPhone(order.customer_phone);

  if (!chatId) {
    return null;
  }

  return sendGreenApiTextMessage(chatId, formatCustomerOrderCanceledNotification(order));
}

export function formatCustomerRevisionProposalNotification(
  order: Order,
  items: OrderItem[],
  note?: string | null,
) {
  return [
    "DC Bakery",
    "",
    `Менеджер предложил изменить заявку ${order.order_number}.`,
    note ? `Комментарий: ${note}` : null,
    "",
    ...items.map(formatOrderLine),
    "",
    `Итого: ${formatPrice(order.total_amount)}`,
    "",
    "Ответьте:",
    "принять — согласиться с измененной заявкой",
    "изменить <комментарий> — попросить другую правку",
    "отменить — отменить заявку",
  ]
    .filter(Boolean)
    .join("\n");
}

export async function sendCustomerRevisionProposalNotification(
  order: Order,
  items: OrderItem[],
  note?: string | null,
) {
  const chatId = getWhatsAppChatIdFromPhone(order.customer_phone);

  if (!chatId) {
    return null;
  }

  return sendGreenApiTextMessage(
    chatId,
    formatCustomerRevisionProposalNotification(order, items, note),
  );
}
