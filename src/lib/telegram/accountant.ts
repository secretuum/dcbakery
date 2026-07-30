import "server-only";
import type { Order } from "@/src/types";
import { formatPrice } from "@/src/lib/format";
import { orderTotalWithDelivery } from "@/app/constants";
import { getCompanyDetails } from "@/src/lib/company-details";
import { idsForRole } from "@/src/lib/telegram/roles";
import { sendMessage } from "@/src/lib/telegram/api";
import type { AwaitingPaymentRow } from "@/src/lib/orders/awaiting-payment";

type CardMessage = {
  text: string;
  replyMarkup?: { inline_keyboard: { text: string; callback_data: string }[][] };
};

// Интерфейс бухгалтера в боте:
//  • при подтверждении заявки — реквизиты + состав приходят ей в ЛС (кнопка «Оплачено»);
//  • раздел «📋 Заказы» — список ждущих оплаты → детали заказа → отметить оплату.
// Оплату отмечает только бухгалтер/админ; в общем чате кнопки «Оплачено» больше нет.

const AWAITING_BUTTON = "⏳ Ждут оплаты";
const PAID_BUTTON = "✅ Оплаченные";

/** Постоянная клавиатура бухгалтера/админа: две кнопки — ждут оплаты / оплаченные. */
export function accountantKeyboard(): { keyboard: { text: string }[][]; resize_keyboard: boolean; is_persistent: boolean } {
  return {
    keyboard: [[{ text: AWAITING_BUTTON }, { text: PAID_BUTTON }]],
    resize_keyboard: true,
    is_persistent: true,
  };
}

/** Команда «Ждут оплаты». */
export function isAwaitingCommand(text: string): boolean {
  const t = text.trim();
  return t === "/orders" || t === AWAITING_BUTTON;
}

/** Команда «Оплаченные». */
export function isPaidCommand(text: string): boolean {
  const t = text.trim();
  return t === "/paid" || t === PAID_BUTTON;
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
  const delivery = order.delivery_amount ?? 0;
  lines.push(`Доставка: ${delivery > 0 ? formatPrice(delivery) : "бесплатно"}`);
  lines.push(`Сумма: ${formatPrice(orderTotalWithDelivery(order))}`);
  if (c.taxNote) lines.push(c.taxNote);
  return lines.join("\n");
}

/** Оплаченный заказ: компактно «№ + ✓», без кнопки. */
export function buildAccountantPaidCard(order: Order): CardMessage {
  return { text: `✅ Счёт №${order.order_number} — оплачено` };
}

/**
 * Компактная карточка для бухгалтера: номер счёта + сумма + реквизиты + PDF.
 * Состав/статус/контакты убраны — их видно в карточке заказа у менеджера.
 * Оплаченный заказ показываем как «№ + ✓» (кнопки нет).
 */
export function buildAccountantDetail(order: Order, origin: string): CardMessage {
  const isPaid = order.status === "paid" || order.payment_status === "paid";
  if (isPaid) {
    return buildAccountantPaidCard(order);
  }

  const invoiceUrl = `${origin.replace(/\/$/, "")}/documents/invoice/${order.id}`;
  const text = [
    `🧾 Счёт №${order.order_number} · ${formatPrice(orderTotalWithDelivery(order))}`,
    order.company_name || null,
    order.due_date ? `Оплатить до: ${order.due_date}` : null,
    "————————",
    requisitesBlock(order),
    "————————",
    `Счёт (PDF): ${invoiceUrl}`,
  ]
    .filter(Boolean)
    .join("\n");

  return {
    text,
    replyMarkup: {
      inline_keyboard: [[{ text: "💰 Оплачено", callback_data: `paid:${order.id}` }]],
    },
  };
}

/** Список ждущих оплаты для раздела «Заказы» (кнопка на каждый заказ). */
export function buildAwaitingPaymentList(orders: AwaitingPaymentRow[]) {
  if (orders.length === 0) {
    return { text: "📋 Заказы\n\nНет заказов, ждущих оплаты 👍", replyMarkup: undefined };
  }

  const text = `⏳ Ждут оплаты (${orders.length})\nВыберите заказ, чтобы открыть детали:`;
  const rows = orders.map((o) => {
    const overdue = o.status === "overdue" ? " ⏰" : "";
    const label = `№${o.order_number} · ${shortDate(o.created_at)} · ${formatPrice(orderTotalWithDelivery(o))}${overdue}`;
    return [{ text: label, callback_data: `open:${o.id}` }];
  });

  return { text, replyMarkup: { inline_keyboard: rows } };
}

/** Список оплаченных заказов (кнопка «Оплаченные»). */
export function buildPaidList(orders: AwaitingPaymentRow[]): CardMessage {
  if (orders.length === 0) {
    return { text: "✅ Оплаченные\n\nПока нет оплаченных заказов." };
  }

  const text = `✅ Оплаченные (${orders.length})\nВыберите заказ, чтобы открыть детали:`;
  const rows = orders.map((o) => [
    {
      text: `№${o.order_number} · ${shortDate(o.created_at)} · ${formatPrice(orderTotalWithDelivery(o))}`,
      callback_data: `open:${o.id}`,
    },
  ]);

  return { text, replyMarkup: { inline_keyboard: rows } };
}

/** Разослать реквизиты заказа всем бухгалтерам в ЛС (после подтверждения заявки). */
export async function notifyAccountantsAwaitingPayment(order: Order, origin: string): Promise<void> {
  const ids = idsForRole("accountant");
  if (ids.length === 0) return;

  const { text, replyMarkup } = buildAccountantDetail(order, origin);

  await Promise.all(
    ids.map((id) =>
      sendMessage({ chatId: id, text, replyMarkup }).catch(() => null),
    ),
  );
}
