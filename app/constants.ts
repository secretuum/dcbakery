export const RETAIL_SITE_URL =
  process.env.NEXT_PUBLIC_RETAIL_SITE_URL ?? "https://example.com";

// Жёсткого минимума заказа больше нет — вместо него тарифы доставки (см. ниже).
// Оставлено = 0, чтобы существующие проверки `total < MIN_ORDER_AMOUNT` не блокировали.
export const MIN_ORDER_AMOUNT = 0;

// Доставка: бесплатно от этой суммы, иначе тариф по deliveryFee().
export const FREE_DELIVERY_THRESHOLD = 15000;

/** Тариф доставки по сумме корзины: >15000 — бесплатно, 10000–15000 — 1500 ₸, ниже — 3000 ₸. */
export function deliveryFee(subtotal: number): number {
  if (subtotal > FREE_DELIVERY_THRESHOLD) return 0;
  if (subtotal >= 10000) return 1500;
  return 3000;
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
