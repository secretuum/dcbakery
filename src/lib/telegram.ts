import "server-only";
import type { Order, OrderItem } from "@/src/types";
import { buildOrderCard } from "@/src/lib/telegram/order-card";
import { sendMessage } from "@/src/lib/telegram/api";

// Уведомление о новой заявке: карточка с кнопками в общий рабочий чат
// (TELEGRAM_GROUP_CHAT_ID, с откатом на старый TELEGRAM_CHAT_ID). Возвращает
// message_id карточки — заказ-роут сохраняет его как telegram_message_id.

export async function sendTelegramNotification(order: Order, items: OrderItem[]) {
  const chatId =
    process.env.TELEGRAM_GROUP_CHAT_ID?.trim() || process.env.TELEGRAM_CHAT_ID?.trim();

  if (!chatId) {
    return null;
  }

  const { text, replyMarkup } = buildOrderCard(order, items);
  return sendMessage({ chatId, text, replyMarkup });
}
