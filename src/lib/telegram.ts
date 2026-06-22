import type { Order, OrderItem } from "@/src/types";
import { formatPrice } from "@/src/lib/format";

type TelegramResult = {
  message_id?: number;
};

function optional(value?: string | null) {
  return value?.trim() ? value : "не указано";
}

function formatOrderLine(item: OrderItem) {
  const total = item.price > 0 ? formatPrice(item.total_amount) : "Цена уточняется";
  return `- ${item.product_name} x ${item.qty} ${item.unit} = ${total}`;
}

export function formatTelegramNotification(order: Order, items: OrderItem[]) {
  const itemLines = items.map(formatOrderLine).join("\n");

  return [
    `Новая заявка ${order.order_number}`,
    `Компания: ${order.company_name}`,
    `Контакт: ${order.customer_name} / ${order.customer_phone}`,
    `Адрес: ${optional(order.delivery_address)}`,
    `Дата: ${optional(order.delivery_date)} | Время: ${optional(order.delivery_time)}`,
    "--------------------",
    itemLines,
    "--------------------",
    `Итого: ${formatPrice(order.total_amount)}`,
    `Оплата: ${optional(order.payment_method)}`,
    order.comment ? `Комментарий: ${order.comment}` : null,
  ]
    .filter(Boolean)
    .join("\n");
}

export async function sendTelegramNotification(order: Order, items: OrderItem[]) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;

  if (!token || !chatId) {
    return null;
  }

  const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      chat_id: chatId,
      text: formatTelegramNotification(order, items),
    }),
  });

  if (!response.ok) {
    return null;
  }

  const payload = (await response.json()) as { result?: TelegramResult };
  return payload.result?.message_id ?? null;
}
