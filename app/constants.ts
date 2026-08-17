export const RETAIL_SITE_URL =
  process.env.NEXT_PUBLIC_RETAIL_SITE_URL ?? "https://example.com";

// Минимальная сумма заказа (стоимость товаров, без доставки). Заказы дешевле НЕ
// оформляются — жёсткий блок в корзине/чекауте, в серверной валидации и в WhatsApp-боте.
export const MIN_ORDER_AMOUNT = 15000;

// Потолок кредитного лимита клиента (отсрочки). Админ выставляет 0…MAX; больше —
// обрезается до MAX при сохранении. Раньше де-факто ставили до 300к, теперь потолок 50к.
export const MAX_CREDIT_LIMIT = 50000;

// Доставка по Алматы — БЕСПЛАТНАЯ на все заказы (платных тарифов больше нет).
// Параметр (сумма корзины) сохранён для совместимости вызовов; результат всегда 0.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function deliveryFee(subtotal?: number): number {
  return 0;
}

/** Человеко-читаемое описание доставки для WhatsApp-бота и подсказок. */
export function describeDeliveryTariff(): string {
  return "Доставка по Алматы бесплатная на все заказы.";
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

// Тип клиента для формы заказа/регистрации. БИН обязателен для legal/ip (у физлица
// БИН нет). Значения совпадают с типом CustomerType в src/types.
export const CUSTOMER_TYPE_OPTIONS = [
  { value: "legal", label: "Юрлицо (ТОО/АО)", requiresBin: true },
  { value: "ip", label: "ИП", requiresBin: true },
  { value: "individual", label: "Физлицо", requiresBin: false },
] as const;

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
