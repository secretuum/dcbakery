export const RETAIL_SITE_URL =
  process.env.NEXT_PUBLIC_RETAIL_SITE_URL ?? "https://example.com";

export const MIN_ORDER_AMOUNT = 15000;

export const B2B_PAYMENT_METHODS = ["Выставить счет", "Безналичный расчет"] as const;

export const WHATSAPP_SUPPORT_NUMBER =
  process.env.NEXT_PUBLIC_WHATSAPP_SUPPORT ?? "77477272650";

export type B2BPaymentMethod = (typeof B2B_PAYMENT_METHODS)[number];

export function normalizeB2BPaymentMethod(value?: string | null): B2BPaymentMethod {
  const normalizedValue = value?.trim().toLowerCase() ?? "";

  return normalizedValue.includes("безнал")
    ? "Безналичный расчет"
    : "Выставить счет";
}
