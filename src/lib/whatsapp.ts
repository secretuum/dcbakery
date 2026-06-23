import "server-only";
import type { Order, OrderItem } from "@/src/types";
import { formatPrice } from "@/src/lib/format";
import { orderStatusLabels, paymentStatusLabels } from "@/src/lib/order-status";
import { formatResponsibleBlock, getOrderResponsibleContext } from "@/src/lib/responsibles";

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

function getResponsibleChatIds(items: OrderItem[]) {
  return Array.from(
    new Set(
      getOrderResponsibleContext(items).people.flatMap((person) => {
        if (person.phone) {
          const chatId = getWhatsAppChatIdFromPhone(person.phone);
          return chatId ? [chatId] : [];
        }

        return [];
      }),
    ),
  );
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
  const chatId = process.env.GREEN_API_CHAT_ID;

  if (!chatId) {
    return null;
  }

  const managerMessageId = await sendGreenApiTextMessage(chatId, formatWhatsAppNotification(order, items));
  const directMessage = formatResponsibleDirectNotification(order, items);

  await Promise.all(
    getResponsibleChatIds(items).map((responsibleChatId) =>
      sendGreenApiTextMessage(responsibleChatId, directMessage).catch(() => null),
    ),
  );

  return managerMessageId;
}

export async function replaceWhatsAppOrderMessage(order: Order, previousMessageId?: string | null) {
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

export function formatPaymentLinkNotification(order: Order, paymentUrl: string) {
  return [
    "DC Bakery",
    "",
    `Ваш заказ №${order.order_number} подтвержден.`,
    "",
    `Сумма к оплате: ${formatPrice(order.total_amount)}`,
    "",
    "Оплатить заказ можно по ссылке:",
    paymentUrl,
    "",
    "После оплаты заказ будет передан в работу.",
  ].join("\n");
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
    "Оплата: Kaspi / Halyk / Freedom / Счет / Наличные",
    "Комментарий:",
    "",
    "Ссылка на оплату/страницу заявки:",
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
