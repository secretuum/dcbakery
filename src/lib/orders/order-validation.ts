// Чистая (без сети/сервера) валидация заказа — вынесена из app/api/orders/route.ts,
// чтобы денежный путь был покрыт тестами. Роут делегирует сюда: логика та же.

import { B2B_PAYMENT_METHODS, MIN_ORDER_AMOUNT } from "@/app/constants";
import type { CustomerType, Product } from "@/src/types";
import { isValidBin } from "@/src/lib/antifraud/company-check";

export type OrderValidationBody = {
  company_name?: string;
  customer_bin?: string | null;
  customer_type?: CustomerType | null;
  customer_name?: string;
  customer_phone?: string;
  delivery_date?: string;
  items?: { product_id: string; qty: number; price?: number }[];
  payment_method?: string;
  oferta_accepted?: boolean;
};

/** Локальная дата «YYYY-MM-DD» → день недели (0=вс…6=сб), UTC-полночь (без «плавания» по TZ). */
export function deliveryWeekday(dateStr: string): number {
  return new Date(`${dateStr}T00:00:00Z`).getUTCDay();
}

/**
 * Проверка полей заказа. `tomorrowDate` («YYYY-MM-DD») передаётся снаружи, чтобы
 * функция была детерминированной и тестируемой. Возвращает ошибки + сумму товаров.
 */
export function validateOrderFields(
  body: OrderValidationBody,
  deliveryDays: number[],
  tomorrowDate: string,
): { errors: string[]; totalAmount: number } {
  const errors: string[] = [];
  const phoneDigits = body.customer_phone?.replace(/\D/g, "") ?? "";
  const items = body.items ?? [];
  const totalAmount = items.reduce((sum, item) => sum + (item.price ?? 0) * item.qty, 0);

  if (!body.company_name) {
    errors.push("company_name is required");
  }

  // Юрлицо/ИП обязаны указать БИН (12 цифр) — для антифрод-сверки с госреестром.
  // Физлицо (самозанятый) БИН не имеет. Тип не задан (старый клиент/прямой POST) →
  // требование не навязываем (обратная совместимость; антифрод остаётся мягким).
  if (
    (body.customer_type === "legal" || body.customer_type === "ip") &&
    !isValidBin(body.customer_bin)
  ) {
    errors.push("customer_bin is required for legal/ip");
  }

  if (!body.customer_name) {
    errors.push("customer_name is required");
  }

  if (phoneDigits.length < 11) {
    errors.push("customer_phone is invalid");
  }

  if (!body.delivery_date) {
    errors.push("delivery_date is required");
  } else if (body.delivery_date < tomorrowDate) {
    errors.push("delivery_date must be tomorrow or later");
  } else if (deliveryDays.length > 0 && !deliveryDays.includes(deliveryWeekday(body.delivery_date))) {
    errors.push("delivery_date is not an allowed delivery day");
  }

  if (items.length === 0) {
    errors.push("items are required");
  }

  if (
    !body.payment_method ||
    !B2B_PAYMENT_METHODS.includes(body.payment_method as (typeof B2B_PAYMENT_METHODS)[number])
  ) {
    errors.push("payment_method is invalid");
  }

  // Жёсткого минимума нет (MIN_ORDER_AMOUNT=0 — минимум реализован тарифами доставки),
  // но нулевую сумму (только quote-позиции по 0 ₸) не создаём.
  if (totalAmount <= 0) {
    errors.push("order total must be greater than zero");
  } else if (totalAmount < MIN_ORDER_AMOUNT) {
    errors.push("minimum order amount is not reached");
  }

  if (!body.oferta_accepted) {
    errors.push("oferta must be accepted");
  }

  return { errors, totalAmount };
}

export type ResolvableItem = { product_id: string; qty: number };
export type ResolvedItem = { product_id: string; qty: number };

/**
 * Серверная сверка позиций с каталогом (цены/остаток/минимум — только из Product,
 * не из клиента). Чистая: каталог приходит параметром. Неизвестные/нет в наличии/
 * дробное количество/сверх остатка/ниже минимума → ошибка, позиция отбрасывается.
 */
export function resolveCartItems(
  items: ResolvableItem[],
  products: Product[],
): { errors: string[]; productMap: Map<string, Product>; resolvedItems: ResolvedItem[] } {
  const productMap = new Map(products.map((product) => [product.id, product]));
  const errors: string[] = [];
  const resolvedItems = items.flatMap((item): ResolvedItem[] => {
    const product = productMap.get(item.product_id);

    if (!product) {
      errors.push(`unknown product: ${item.product_id}`);
      return [];
    }
    if (product.stock_qty <= 0) {
      errors.push(`product is out of stock: ${product.name}`);
      return [];
    }
    if (!Number.isInteger(item.qty)) {
      errors.push(`quantity must be a whole number: ${product.name}`);
      return [];
    }
    if (item.qty > product.stock_qty) {
      errors.push(`requested quantity exceeds stock: ${product.name}`);
      return [];
    }
    if (item.qty < product.min_qty) {
      errors.push(`requested quantity is below minimum: ${product.name}`);
      return [];
    }

    return [{ product_id: product.id, qty: item.qty }];
  });

  return { errors, productMap, resolvedItems };
}
