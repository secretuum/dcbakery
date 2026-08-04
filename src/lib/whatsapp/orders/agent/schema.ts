// Контракт вывода LLM-агента. Модель отдаёт conversational-ответ + действия с
// корзиной (по id товара из каталога) + сигнал шага. ЦЕН/итогов в схеме НЕТ —
// их считает сервер; действия проходят строгую валидацию (id только из каталога).

import { LIMITS } from "../config";

export const AGENT_OPERATIONS = ["add", "remove", "set"] as const;
export type AgentOperation = (typeof AGENT_OPERATIONS)[number];

export const AGENT_INTENTS = ["chat", "checkout", "repeat_order", "cancel", "handoff"] as const;
export type AgentIntent = (typeof AGENT_INTENTS)[number];

export type AgentCartAction = {
  productId: string;
  quantity: number;
  operation: AgentOperation;
};

export type AgentOutput = {
  /** Текст ответа клиенту (на его языке). Без цен/итогов — их добавит сервер. */
  reply: string;
  cartActions: AgentCartAction[];
  /** Показать актуальную корзину (сервер отрендерит с реальными ценами). */
  showCart: boolean;
  /** chat — обычный диалог; checkout — клиент готов оформлять; и т.д. */
  intent: AgentIntent;
};

/**
 * Ответ агента для оркестратора: вывод модели + серверный флаг деградации.
 * `degraded` НЕ входит в JSON-схему LLM — его ставит сервер, когда модель
 * недоступна/вернула мусор (тогда оркестратор даёт мягкий фолбэк).
 */
export type AgentResponse = AgentOutput & { degraded?: boolean };

export const AGENT_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["reply", "cartActions", "showCart", "intent"],
  properties: {
    reply: { type: "string" },
    cartActions: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["productId", "quantity", "operation"],
        properties: {
          productId: { type: "string" },
          quantity: { type: "integer", minimum: 0 },
          operation: { type: "string", enum: [...AGENT_OPERATIONS] },
        },
      },
    },
    showCart: { type: "boolean" },
    intent: { type: "string", enum: [...AGENT_INTENTS] },
  },
} as const;

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

export type AgentParseResult = { ok: true; output: AgentOutput } | { ok: false; error: string };

/**
 * Строгая валидация вывода модели. Действия с товарами, чей id НЕ из каталога,
 * отбрасываются (модель не может добавить несуществующий товар). Количество —
 * целое в [0..maxItemQuantity]. reply обрезается по разумному лимиту.
 */
export function parseAgentOutput(raw: unknown, validProductIds: Set<string>): AgentParseResult {
  if (!isRecord(raw)) return { ok: false, error: "agent output is not an object" };

  const reply = typeof raw.reply === "string" ? raw.reply.trim().slice(0, 2000) : "";

  const intent: AgentIntent = (AGENT_INTENTS as readonly string[]).includes(raw.intent as string)
    ? (raw.intent as AgentIntent)
    : "chat";

  const showCart = raw.showCart === true;

  const rawActions = Array.isArray(raw.cartActions) ? raw.cartActions : [];
  const cartActions: AgentCartAction[] = [];
  for (const entry of rawActions) {
    if (cartActions.length >= LIMITS.maxIntentItems) break;
    if (!isRecord(entry)) continue;
    const productId = typeof entry.productId === "string" ? entry.productId.trim() : "";
    if (!productId || !validProductIds.has(productId)) continue; // только реальные товары
    const qtyNum = typeof entry.quantity === "number" ? entry.quantity : Number(entry.quantity);
    if (!Number.isFinite(qtyNum)) continue;
    const quantity = Math.min(Math.max(0, Math.floor(qtyNum)), LIMITS.maxItemQuantity);
    const operation: AgentOperation = (AGENT_OPERATIONS as readonly string[]).includes(
      entry.operation as string,
    )
      ? (entry.operation as AgentOperation)
      : "add";
    cartActions.push({ productId, quantity, operation });
  }

  return { ok: true, output: { reply, cartActions, showCart, intent } };
}
