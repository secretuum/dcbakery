import "server-only";
import type { Order, OrderItem } from "@/src/types";
import { formatPrice } from "@/src/lib/format";
import { orderStatusLabels } from "@/src/lib/order-status";
import { getCompanyDetails } from "@/src/lib/company-details";
import { idsForRole } from "@/src/lib/telegram/roles";
import { sendMessage } from "@/src/lib/telegram/api";
import { fetchAdminOrderItems } from "@/src/lib/supabase/admin";
import type { AwaitingPaymentRow } from "@/src/lib/orders/awaiting-payment";

// Интерфейс бухгалтера в боте:
//  • при подтверждении заявки — реквизиты + состав приходят ей в ЛС (кнопка «Оплачено»);
//  • раздел «📋 Заказы» — список ждущих оплаты → детали заказа → отметить оплату.
// Оплату отмечает только бухгалтер/админ; в общем чате кнопки «Оплачено» больше нет.

const ORDERS_BUTTON = "📋 Заказы";

/** Постоянная клавиатура с кнопкой «Заказы» (для ЛС бухгалтера/админа). */
export function accountantKeyboard(): { keyboard: { text: string }[][]; resize_keyboard: boolean; is_persistent: boolean } {
  return { keyboard: [[{ text: ORDERS_BUTTON }]], resize_keyboard: true, is_persistent: true };
}

/** Текст сообщения — команда открытия раздела «Заказы»? */
export function isOrdersCommand(text: string): boolean {
  const t = text.trim();
  return t === "/orders" || t === ORDERS_BUTTON;
}

// created_at приходит ISO-строкой — показываем компактно ДД.ММ.
function shortDate(iso?: string | null): string {
  if (!iso) return "—";
  const [, m, day] = iso.slice(0, 10).split("-");
  return day && m ? `${day}.${m}` : iso.slice(0, 10);
}

function requisitesBlock(order: Order): string {
  const c = getCompanyDetails();
  const lines: string[] = [];
  if (c.legalName) lines.push(`Получатель: ${c.legalName}`);
  if (c.bin) lines.push(`БИН: ${c.bin}`);
  if (c.bankName) lines.push(`Банк: ${c.bankName}${c.bankBic ? ` (БИК ${c.bankBic})` : ""}`);
  if (c.bankIban) lines.push(`IBAN (основной): ${c.bankIban}`);
  if (c.bankIbanPf) lines.push(`IBAN (Цех ПФ): ${c.bankIbanPf}`);
  lines.push(`Назначение: оплата по счёту №${order.order_number}`);
  lines.push(`Сумма: ${formatPrice(order.total_amount)}`);
  if (c.taxNote) lines.push(c.taxNote);
  return lines.join("\n");
}

/** Полная карточка заказа для бухгалтера: инфо + состав + реквизиты + кнопка оплаты. */
export function buildAccountantDetail(order: Order, items: OrderItem[], origin: string) {
  const itemLines = items
    .map((i) => {
      const sum = i.price > 0 ? formatPrice(i.total_amount) : "уточняется";
      return `• ${i.product_name} × ${i.qty} ${i.unit} = ${sum}`;
    })
    .join("\n");

  const isPaid = order.status === "paid" || order.payment_status === "paid";
  const invoiceUrl = `${origin.replace(/\/$/, "")}/documents/invoice/${order.id}`;

  const text = [
    `🧾 Заявка ${order.order_number}`,
    `Статус: ${orderStatusLabels[order.status] ?? order.status}`,
    `Компания: ${order.company_name}`,
    order.customer_name || order.customer_phone
      ? `Контакт: ${[order.customer_name, order.customer_phone].filter(Boolean).join(" / ")}`
      : null,
    order.due_date ? `Оплатить до: ${order.due_date}` : null,
    "————————",
    itemLines || "—",
    "————————",
    "Реквизиты для оплаты:",
    requisitesBlock(order),
    "————————",
    `Счёт (PDF): ${invoiceUrl}`,
  ]
    .filter(Boolean)
    .join("\n");

  const button = isPaid
    ? { text: "↩️ Снять оплату", action: "unpaid" }
    : { text: "💰 Оплачено", action: "paid" };

  return {
    text,
    replyMarkup: {
      inline_keyboard: [[{ text: button.text, callback_data: `${button.action}:${order.id}` }]],
    },
  };
}

/** Список ждущих оплаты для раздела «Заказы» (кнопка на каждый заказ). */
export function buildAwaitingPaymentList(orders: AwaitingPaymentRow[]) {
  if (orders.length === 0) {
    return { text: "📋 Заказы\n\nНет заказов, ждущих оплаты 👍", replyMarkup: undefined };
  }

  const text = `📋 Заказы, ждущие оплаты (${orders.length})\nВыберите заказ, чтобы открыть детали:`;
  const rows = orders.map((o) => {
    const overdue = o.status === "overdue" ? " ⏰" : "";
    const label = `№${o.order_number} · ${shortDate(o.created_at)} · ${formatPrice(o.total_amount)}${overdue}`;
    return [{ text: label, callback_data: `open:${o.id}` }];
  });

  return { text, replyMarkup: { inline_keyboard: rows } };
}

/** Разослать реквизиты заказа всем бухгалтерам в ЛС (после подтверждения заявки). */
export async function notifyAccountantsAwaitingPayment(order: Order, origin: string): Promise<void> {
  const ids = idsForRole("accountant");
  if (ids.length === 0) return;

  const items = await fetchAdminOrderItems(order.id).catch(() => []);
  const { text, replyMarkup } = buildAccountantDetail(order, items, origin);
  const header = "💵 Новый заказ ждёт оплаты. Проверьте поступление и отметьте «Оплачено»:";

  await Promise.all(
    ids.map((id) =>
      sendMessage({ chatId: id, text: `${header}\n\n${text}`, replyMarkup }).catch(() => null),
    ),
  );
}
