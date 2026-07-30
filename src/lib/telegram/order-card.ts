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
    case "overdue":
      // Статус НЕ зависит от оплаты (консигнация): после подтверждения менеджер
      // сразу берёт заказ в работу. Оплату отмечает бухгалтер отдельной осью
      // (кнопка «Оплачено» в ЛС/«Заказы»), она не блокирует движение заказа.
      return [
        { text: "🏭 В работу", action: "work" },
        { text: "✖️ Отменить", action: "cancel" },
      ];
    case "paid":
      // Легаси: заказы, отмеченные оплаченными по старой модели (status=paid).
      // Новые заказы сюда не попадают (оплата теперь только payment_status).
      return [{ text: "🏭 В работу", action: "work" }];
    case "in_progress":
      // Отменить можно до отгрузки; после «Доставляется» — только вручную.
      return [
        { text: "🚚 Доставляется", action: "deliver" },
        { text: "✖️ Отменить", action: "cancel" },
      ];
    case "delivering":
      // «Выполнен» сработает только после отметки оплаты (проверка на сервере).
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
    order.payment_status === "paid" ? "💰 Оплачено" : "⏳ Ожидает оплаты",
    `Компания: ${order.company_name}`,
    `Контакт: ${order.customer_name} / ${order.customer_phone}`,
    order.delivery_date
      ? `Доставка: ${order.delivery_date}${order.delivery_time ? ` ${order.delivery_time}` : ""}`
      : `Доставка: ${optional(order.delivery_address)}`,
    "————————",
    lines,
    "————————",
    `Доставка: ${(order.delivery_amount ?? 0) > 0 ? formatPrice(order.delivery_amount ?? 0) : "бесплатно"}`,
    `Итого: ${formatPrice(order.total_amount + (order.delivery_amount ?? 0))}`,
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
