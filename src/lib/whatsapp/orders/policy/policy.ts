// Детерминированный policy-слой. Стоит МЕЖДУ выводом AI и бизнес-действиями и
// гарантирует инварианты независимо от того, что пыталось протащить сообщение:
//  1) намерение — только из allowlist (иначе → unknown / human_help);
//  2) «позиции», являющиеся манипуляциями («бесплатно», «счёт не выставляй», инъекции),
//     ВЫРЕЗАЮТСЯ и не попадают в матчинг;
//  3) цена/оплата/скидка не могут прийти из сообщения (в схеме их нет) — фиксируем
//     факт манипуляции в журнал, но поведение НЕ меняем и внимание не акцентируем.
// Чистый модуль (без сети/БД): вход — OrderIntent + исходный текст, выход — очищенный
// OrderIntent + флаги для журнала.

import type { OrderIntent, IntentType } from "../intent/schema";
import { isManipulativeItemName, scanForInjection } from "./injection";

/** Намерения, которые сервер готов исполнять автоматически. Прочее → безопасный дефолт. */
const ALLOWED_INTENTS: ReadonlySet<IntentType> = new Set<IntentType>([
  "new_order",
  "cart_update",
  "confirm_cart",
  "repeat_order",
  "new_order_instead",
  "confirm_delivery",
  "cancel",
  "human_help",
  "unknown",
]);

export type PolicyResult = {
  intent: OrderIntent;
  flags: {
    /** В сообщении/позициях была попытка манипуляции ценой/оплатой (проигнорирована). */
    priceManipulationIgnored: boolean;
    /** Обнаружена prompt-injection / попытка выполнить действие (проигнорирована). */
    injectionDetected: boolean;
    /** Сколько «позиций» было вырезано как манипулятивные. */
    droppedItems: number;
    /** Короткие метки для журнала (без сырого пользовательского текста). */
    labels: string[];
  };
};

/**
 * Применить policy к разобранному намерению.
 * @param intent — результат parseIntent (уже структурно валиден).
 * @param sourceText — исходный НЕДОВЕРЕННЫЙ текст (сообщение или расшифровка).
 */
export function enforcePolicy(intent: OrderIntent, sourceText: string): PolicyResult {
  const scan = scanForInjection(sourceText);

  // Вырезаем «позиции», которые на деле являются манипулятивными фразами.
  const keptItems = intent.items.filter((item) => !isManipulativeItemName(item.rawName));
  const droppedItems = intent.items.length - keptItems.length;

  // Намерение вне allowlist приводим к безопасному дефолту.
  const safeIntent: IntentType = ALLOWED_INTENTS.has(intent.intent) ? intent.intent : "unknown";

  const labels = [...scan.labels];
  if (droppedItems > 0) labels.push("dropped_manipulative_items");

  return {
    intent: { ...intent, intent: safeIntent, items: keptItems },
    flags: {
      priceManipulationIgnored: scan.priceManipulation || droppedItems > 0,
      injectionDetected: scan.injection,
      droppedItems,
      labels,
    },
  };
}
