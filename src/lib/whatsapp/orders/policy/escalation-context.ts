// Контекст эскалации на менеджера: превращаем «сырую» причину + данные диалога в
// осмысленное сообщение для Telegram-группы. Раньше менеджеру уходил голый текст
// «Нужна помощь менеджера. Причина: … Чат: …». Теперь — номер клиента, что он хотел,
// что ответил бот, почему не решилось, настроение одним словом и флаг срочности «горит»
// (по ответам владельца: Q78 — состав эскалации, Q79 — «горит», Q83 — настроение).
// Модуль ЧИСТЫЙ (без сети/server-only): сообщение строит он, а отправляет notifyManager.

import type { EscalationReason } from "./escalation";

export type EscalationContext = {
  chatId: string;
  /** Номер клиента (может быть неизвестен для некоторых путей). */
  clientPhone: string | null;
  /** Что хотел клиент — его последнее сообщение. */
  clientWanted: string;
  /** Что ответил бот (для agent-handoff); для абьюза/технических — обычно нет. */
  botAnswered: string | null;
  /** Машинная причина (escalation:complaint | agent_handoff | order_create_failed …). */
  reason: string;
  /** Человеческая формулировка «почему не решилось». */
  whyUnresolved: string;
  /** Настроение клиента одним словом (или null, если неприменимо). */
  mood: string | null;
  /** Срочно ли (флаг «горит»). */
  urgent: boolean;
};

/** Слова явной срочности в сообщении клиента → помечаем эскалацию как «горит». */
const URGENCY_RE = /сроч|горит|быстрее|немедлен|неотложн|прямо сейчас|urgent|асап|қазір керек/i;

export function urgencyFromText(text: string): boolean {
  return URGENCY_RE.test(text);
}

/** Настроение по причине абьюз-эскалации (когда до LLM не дошли и mood от модели нет). */
export function moodFromReason(reason?: EscalationReason): string {
  switch (reason) {
    case "profanity":
    case "insult":
      return "агрессивен";
    case "complaint":
      return "недоволен";
    case "shouting":
      return "раздражён";
    default:
      return "недоволен";
  }
}

/**
 * Разбор машинной причины лида в человеческую формулировку + дефолтные mood/urgent.
 * Значения из extra в оркестраторе (mood/handoffReason от LLM) имеют приоритет над этими.
 */
export function describeLeadReason(reason: string): { why: string; mood: string | null; urgent: boolean } {
  if (reason.startsWith("escalation:")) {
    const sub = reason.slice("escalation:".length) as EscalationReason;
    const mood = moodFromReason(sub);
    switch (sub) {
      case "profanity":
      case "insult":
        return { why: "клиент грубит или оскорбляет — нужен человек", mood, urgent: true };
      case "complaint":
        return { why: "жалоба, претензия или угроза", mood, urgent: true };
      case "shouting":
        return { why: "клиент пишет капсом, на эмоциях", mood, urgent: true };
      default:
        return { why: "клиент на эмоциях", mood, urgent: true };
    }
  }
  switch (reason) {
    case "agent_handoff":
      return { why: "бот не смог решить сам (просьба менеджера или вопрос вне данных)", mood: null, urgent: false };
    case "unsupported_attachment":
      return { why: "клиент прислал вложение (фото/файл), бот его не читает — обработайте вручную", mood: null, urgent: false };
    case "delivery_outside_almaty":
      return { why: "адрес вне зоны доставки (доставляем только по Алматы)", mood: null, urgent: false };
    case "missing_phone":
      return { why: "не удалось определить номер клиента", mood: null, urgent: false };
    case "order_create_failed":
      return { why: "ошибка при создании заказа — оформите вручную", mood: null, urgent: true };
    default:
      return { why: reason, mood: null, urgent: false };
  }
}

/** Обрезка поля до разумной длины (у Telegram лимит сообщения 4096 символов). */
function clip(value: string, max: number): string {
  const v = value.trim();
  return v.length > max ? `${v.slice(0, max - 1)}…` : v;
}

/** Кликабельная ссылка на чат клиента в WhatsApp: цифры номера из phone или chatId
 * (WhatsApp chatId вида "77051234567@c.us"). Открывается в один тап из Telegram. */
function chatLink(clientPhone: string | null, chatId: string): string | null {
  const digits = (clientPhone ?? chatId).replace(/\D/g, "");
  return digits.length >= 10 ? `https://wa.me/${digits}` : null;
}

/**
 * Готовое сообщение об эскалации для Telegram-группы менеджеров — человеческим языком,
 * с понятными подписями и кликабельной ссылкой на чат (без технических меток вроде
 * "escalation:profanity"). Менеджер сразу видит: кто, с каким настроением, что хотел,
 * что ответил бот, почему не решилось и как открыть чат.
 */
export function buildEscalationMessage(ctx: EscalationContext): string {
  const link = chatLink(ctx.clientPhone, ctx.chatId);
  const lines = [
    ctx.urgent ? "🔥 ГОРИТ — срочно нужен менеджер" : "Нужен менеджер (WhatsApp)",
    "",
    `Клиент: ${ctx.clientPhone ?? "номер неизвестен"}`,
    ctx.mood ? `Настроение: ${ctx.mood}` : null,
    `Что хотел: ${clip(ctx.clientWanted || "—", 800)}`,
    `Что ответил бот: ${ctx.botAnswered ? clip(ctx.botAnswered, 600) : "—"}`,
    `Почему не решилось: ${clip(ctx.whyUnresolved || ctx.reason, 400)}`,
    link ? `Открыть чат: ${link}` : `Чат: ${ctx.chatId}`,
  ];
  return lines.filter((l): l is string => Boolean(l)).join("\n");
}
