// Явная state-machine диалога оформления заказа через WhatsApp. Чистый модуль:
// только состояния, разрешённые переходы и предикаты — без сети/БД. Персистентность
// (таблица whatsapp_dialog_state) и оркестрация живут отдельно и зовут эти функции.

export const DIALOG_STATES = [
  "idle",
  "building_cart",
  "awaiting_product_clarification",
  "awaiting_cart_confirmation",
  "awaiting_address",
  "awaiting_address_confirmation",
  "awaiting_delivery_period",
  "awaiting_final_confirmation",
  "creating_order",
  "order_submitted",
  "human_handoff",
  "expired",
  "cancelled",
] as const;
export type DialogState = (typeof DIALOG_STATES)[number];

// Разрешённые переходы. Ключ — откуда, значение — набор допустимых «куда».
// Из любого состояния всегда можно уйти в human_handoff / cancelled / expired
// (см. ALWAYS_REACHABLE) — это добавляется автоматически в canTransition.
const TRANSITIONS: Record<DialogState, readonly DialogState[]> = {
  idle: ["building_cart", "awaiting_final_confirmation", "awaiting_cart_confirmation"],
  building_cart: ["building_cart", "awaiting_product_clarification", "awaiting_cart_confirmation"],
  awaiting_product_clarification: ["building_cart", "awaiting_cart_confirmation"],
  awaiting_cart_confirmation: ["building_cart", "awaiting_address"],
  awaiting_address: ["awaiting_address_confirmation", "awaiting_delivery_period"],
  awaiting_address_confirmation: ["awaiting_address", "awaiting_delivery_period"],
  awaiting_delivery_period: ["awaiting_final_confirmation"],
  awaiting_final_confirmation: ["awaiting_cart_confirmation", "awaiting_address", "creating_order"],
  creating_order: ["order_submitted", "awaiting_final_confirmation"],
  order_submitted: ["idle", "building_cart"],
  human_handoff: ["idle", "building_cart"],
  expired: ["idle", "building_cart"],
  cancelled: ["idle", "building_cart"],
};

// В эти состояния можно попасть из ЛЮБОГО (отмена / передача менеджеру / протухание).
const ALWAYS_REACHABLE: readonly DialogState[] = ["human_handoff", "cancelled", "expired"];

/** Разрешён ли переход from → to. */
export function canTransition(from: DialogState, to: DialogState): boolean {
  if (from === to && !TRANSITIONS[from].includes(to)) {
    // Само-переходы разрешаем только там, где они явно заявлены (например building_cart).
    return false;
  }
  return ALWAYS_REACHABLE.includes(to) || TRANSITIONS[from].includes(to);
}

/**
 * Выполнить переход. Возвращает целевое состояние, если он разрешён, иначе —
 * прежнее состояние (переход отклонён; вызывающий решает, что ответить).
 */
export function transition(from: DialogState, to: DialogState): DialogState {
  return canTransition(from, to) ? to : from;
}

/** Терминальные состояния (диалог по этой заявке завершён). */
const TERMINAL: ReadonlySet<DialogState> = new Set<DialogState>([
  "order_submitted",
  "cancelled",
  "expired",
]);

export function isTerminal(state: DialogState): boolean {
  return TERMINAL.has(state);
}

/** В human_handoff бот молчит (авто-ответы приостановлены до возврата менеджером). */
export function isBotSuppressed(state: DialogState): boolean {
  return state === "human_handoff";
}

/** Состояния, в которых уместно продлевать TTL сессии (клиент активно оформляет). */
export function isActiveOrdering(state: DialogState): boolean {
  return !isTerminal(state) && state !== "human_handoff" && state !== "idle";
}
