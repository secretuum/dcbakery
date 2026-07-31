// Контракт вывода AI: строгая схема НАМЕРЕНИЯ. AI ТОЛЬКО извлекает структуру из
// сообщения — он НЕ ходит в БД, НЕ выбирает цену, НЕ выполняет команды. В схеме
// намеренно НЕТ полей цены/скидки/оплаты/суммы — их физически неоткуда протащить.
// Сервер сам валидирует этот объект (parseIntent) и дальше сам матчит/ценит/списывает.

import { LIMITS } from "../config";

export const INTENT_TYPES = [
  "new_order",
  "cart_update",
  "confirm_cart",
  "repeat_order",
  "new_order_instead",
  "confirm_delivery",
  "cancel",
  "human_help",
  "unknown",
] as const;
export type IntentType = (typeof INTENT_TYPES)[number];

export const ITEM_OPERATIONS = ["add", "remove", "set"] as const;
export type ItemOperation = (typeof ITEM_OPERATIONS)[number];

export const DELIVERY_PERIODS = ["morning", "afternoon"] as const;
export type DeliveryPeriod = (typeof DELIVERY_PERIODS)[number];

export type IntentItem = {
  /** Как назвал позицию клиент (НЕДОВЕРЕННОЕ, только для матчинга по каталогу). */
  rawName: string;
  /** Целое количество единиц заказа, > 0. */
  quantity: number;
  operation: ItemOperation;
};

export type OrderIntent = {
  intent: IntentType;
  items: IntentItem[];
  addressText: string | null;
  deliveryPeriod: DeliveryPeriod | null;
  confirmation: boolean;
};

/**
 * JSON Schema для OpenAI structured output (response_format: json_schema).
 * additionalProperties:false + required заставляют модель держаться контракта;
 * но это лишь ПЕРВЫЙ барьер — истину даёт серверный parseIntent ниже.
 */
export const INTENT_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["intent", "items", "addressText", "deliveryPeriod", "confirmation"],
  properties: {
    intent: { type: "string", enum: [...INTENT_TYPES] },
    items: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["rawName", "quantity", "operation"],
        properties: {
          rawName: { type: "string" },
          quantity: { type: "integer", minimum: 1 },
          operation: { type: "string", enum: [...ITEM_OPERATIONS] },
        },
      },
    },
    addressText: { type: ["string", "null"] },
    deliveryPeriod: { type: ["string", "null"], enum: [...DELIVERY_PERIODS, null] },
    confirmation: { type: "boolean" },
  },
} as const;

export type ParseResult =
  | { ok: true; intent: OrderIntent }
  | { ok: false; error: string };

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function clampString(v: unknown, max: number): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim();
  if (!t) return null;
  return t.length > max ? t.slice(0, max) : t;
}

/**
 * СТРОГАЯ серверная валидация «сырого» объекта из AI в OrderIntent.
 * Любое отклонение от контракта — отбраковка/клэмп, а не доверие модели:
 * неизвестный intent → "unknown"; неверные items → отбрасываются; количество
 * приводится к целому в диапазоне [1..maxItemQuantity]; массивы обрезаются по лимиту.
 * Даже если модель сгенерирует мусор или выполнит инъекцию — на выходе валидный объект.
 */
export function parseIntent(raw: unknown): ParseResult {
  if (!isRecord(raw)) return { ok: false, error: "intent is not an object" };

  const intent = (INTENT_TYPES as readonly string[]).includes(raw.intent as string)
    ? (raw.intent as IntentType)
    : "unknown";

  const rawItems = Array.isArray(raw.items) ? raw.items : [];
  const items: IntentItem[] = [];
  for (const entry of rawItems) {
    if (items.length >= LIMITS.maxIntentItems) break;
    if (!isRecord(entry)) continue;

    const rawName = clampString(entry.rawName, LIMITS.maxRawNameLength);
    if (!rawName) continue;

    const qtyNum = typeof entry.quantity === "number" ? entry.quantity : Number(entry.quantity);
    if (!Number.isFinite(qtyNum)) continue;
    const quantity = Math.min(Math.max(1, Math.floor(qtyNum)), LIMITS.maxItemQuantity);

    const operation: ItemOperation = (ITEM_OPERATIONS as readonly string[]).includes(
      entry.operation as string,
    )
      ? (entry.operation as ItemOperation)
      : "add";

    items.push({ rawName, quantity, operation });
  }

  const addressText = clampString(raw.addressText, LIMITS.maxAddressLength);

  const deliveryPeriod = (DELIVERY_PERIODS as readonly string[]).includes(
    raw.deliveryPeriod as string,
  )
    ? (raw.deliveryPeriod as DeliveryPeriod)
    : null;

  const confirmation = raw.confirmation === true;

  return { ok: true, intent: { intent, items, addressText, deliveryPeriod, confirmation } };
}
