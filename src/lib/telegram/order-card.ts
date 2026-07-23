import type { Order, OrderItem, OrderStatus } from "@/src/types";
import { formatPrice } from "@/src/lib/format";
import { orderStatusLabels } from "@/src/lib/order-status";

// Карточка заявки для общего чата: текст + кнопки под текущий статус.
// callback_data кнопки = "<действие>:<orderId>" (укладывается в лимит 64 байта).
// Права проверяются в момент нажатия (roles.canDo), поэтому кнопки показываем
// всем, а пресекаем на сервере, если роль не та.

type CardButton = { text: string; action: string };

function buttonsForStatus(status: OrderStatus): CardButton[] {
  switch (status) {
    case "pending_manager_confirmation":
      return [
        { text: "✅ Подтвердить", action: "confirm" },
        { text: "✖️ Отклонить", action: "reject" },
      ];
    case "confirmed_waiting_payment":
      return [
        { text: "💰 Оплачено", action: "paid" },
        { text: "✖️ Отменить", action: "cancel" },
      ];
    case "paid":
      return [{ text: "🏭 В работу", action: "work" }];
    case "in_progress":
      return [{ text: "🚚 Доставляется", action: "deliver" }];
    case "delivering":
      return [{ text: "✔️ Выполнен", action: "done" }];
    default:
      return [];
  }
}

function optional(value?: string | null) {
  return value?.trim() ? value : "—";
}

export function buildOrderCard(order: Order, items: OrderItem[]) {
  const lines = items
    .map((i) => {
      const sum = i.price > 0 ? formatPrice(i.total_amount) : "уточняется";
      return `• ${i.product_name} × ${i.qty} ${i.unit} = ${sum}`;
    })
    .join("\n");

  const text = [
    `🧾 Заявка ${order.order_number}`,
    `Статус: ${orderStatusLabels[order.status] ?? order.status}`,
    `Компания: ${order.company_name}`,
    `Контакт: ${order.customer_name} / ${order.customer_phone}`,
    order.delivery_date
      ? `Доставка: ${order.delivery_date}${order.delivery_time ? ` ${order.delivery_time}` : ""}`
      : `Доставка: ${optional(order.delivery_address)}`,
    "————————",
    lines,
    "————————",
    `Итого: ${formatPrice(order.total_amount)}`,
    order.comment ? `Комментарий: ${order.comment}` : null,
  ]
    .filter(Boolean)
    .join("\n");

  const buttons = buttonsForStatus(order.status);
  const replyMarkup =
    buttons.length > 0
      ? {
          inline_keyboard: [
            buttons.map((b) => ({ text: b.text, callback_data: `${b.action}:${order.id}` })),
          ],
        }
      : undefined;

  return { text, replyMarkup };
}
