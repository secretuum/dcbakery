export const RETAIL_SITE_URL =
  process.env.NEXT_PUBLIC_RETAIL_SITE_URL ?? "https://example.com";

// Жёсткого минимума заказа больше нет — вместо него тарифы доставки (см. ниже).
// Оставлено = 0, чтобы существующие проверки `total < MIN_ORDER_AMOUNT` не блокировали.
export const MIN_ORDER_AMOUNT = 0;

// Потолок кредитного лимита клиента (отсрочки). Админ выставляет 0…MAX; больше —
// обрезается до MAX при сохранении. Раньше де-факто ставили до 300к, теперь потолок 50к.
export const MAX_CREDIT_LIMIT = 50000;

// Доставка: бесплатно от этой суммы, иначе тариф по deliveryFee().
export const FREE_DELIVERY_THRESHOLD = 15000;
// Единый источник тарифных порогов/сумм (не дублировать в промптах/UI — брать отсюда).
const DELIVERY_MID_THRESHOLD = 10000;
const DELIVERY_FEE_BELOW_MID = 3000;
const DELIVERY_FEE_MID = 1500;

/** Тариф доставки по сумме корзины: от 15000 — бесплатно, 10000–14999 — 1500 ₸, ниже — 3000 ₸. */
export function deliveryFee(subtotal: number): number {
  // «от 15 000 бесплатно» — граница включительна (>=), как в прогресс-барах корзины.
  if (subtotal >= FREE_DELIVERY_THRESHOLD) return 0;
  if (subtotal >= DELIVERY_MID_THRESHOLD) return DELIVERY_FEE_MID;
  return DELIVERY_FEE_BELOW_MID;
}

/**
 * Человеко-читаемое описание тарифа доставки из тех же констант (единый источник).
 * Для WhatsApp-бота и подсказок — чтобы значения не расходились по разным местам.
 */
export function describeDeliveryTariff(): string {
  const n = (v: number) => v.toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  return (
    `Доставка по Алматы: до ${n(DELIVERY_MID_THRESHOLD)} ₸ — ${n(DELIVERY_FEE_BELOW_MID)} ₸; ` +
    `от ${n(DELIVERY_MID_THRESHOLD)} до ${n(FREE_DELIVERY_THRESHOLD)} ₸ — ${n(DELIVERY_FEE_MID)} ₸; ` +
    `от ${n(FREE_DELIVERY_THRESHOLD)} ₸ — бесплатно.`
  );
}

/**
 * Итоговая сумма заказа с учётом доставки.
 * `total_amount` хранит сумму позиций, `delivery_amount` — тариф доставки отдельно.
 * Использовать везде, где показывается/списывается «сумма к оплате» по заказу.
 */
export function orderTotalWithDelivery(order: {
  total_amount: number;
  delivery_amount?: number | null;
}): number {
  return Number(order.total_amount) + Number(order.delivery_amount ?? 0);
}

export const B2B_PAYMENT_METHODS = ["Выставить счет", "Безналичный расчет"] as const;

export const WHATSAPP_SUPPORT_NUMBER =
  process.env.NEXT_PUBLIC_WHATSAPP_SUPPORT ?? "77477272650";

// Категория «Готовые обеды» подготовлена, но скрыта на витрине до запуска.
// Включение: NEXT_PUBLIC_READY_MEALS=1 в env (или поменять фолбэк на true).
export const READY_MEALS_ENABLED =
  process.env.NEXT_PUBLIC_READY_MEALS === "1";

// Категория «Банкетные десерты» скрыта на витрине до запуска.
// Включение: NEXT_PUBLIC_BANQUET_DESSERTS=1 в env.
export const BANQUET_DESSERTS_ENABLED =
  process.env.NEXT_PUBLIC_BANQUET_DESSERTS === "1";

export type B2BPaymentMethod = (typeof B2B_PAYMENT_METHODS)[number];

export function normalizeB2BPaymentMethod(value?: string | null): B2BPaymentMethod {
  const normalizedValue = value?.trim().toLowerCase() ?? "";

  return normalizedValue.includes("безнал")
    ? "Безналичный расчет"
    : "Выставить счет";
}
