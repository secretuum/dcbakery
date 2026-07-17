export const RETAIL_SITE_URL =
  process.env.NEXT_PUBLIC_RETAIL_SITE_URL ?? "https://example.com";

export const MIN_ORDER_AMOUNT = 15000;

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
