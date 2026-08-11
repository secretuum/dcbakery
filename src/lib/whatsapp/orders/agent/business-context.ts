// Живые бизнес-факты для системного контекста агента: часы работы, дни/тариф
// доставки, отсечка приёма, контакты. Многие ответы владельца на вопросы бота —
// «возьми инфу с сайта», поэтому эти значения инжектятся в каждый ответ из
// getSiteContent() (кэш 3600с), а НЕ зашиваются в промпт. Модуль ЧИСТЫЙ (без сети и
// server-only), чтобы тестироваться и не тянуть unstable_cache: тип SiteContent —
// только как type (стирается), тариф — из общего app/constants (не server-only).

import type { SiteContent } from "@/src/lib/site-content";
import { describeDeliveryTariff } from "@/app/constants";

/** Что реально нужно агенту из контента сайта (узкий контракт для теста). */
export type BusinessFacts = Pick<
  SiteContent,
  "workHours" | "contactPhone" | "contactWhatsapp" | "address" | "deliveryDays" | "orderCutoffHour"
>;

// Локальная копия названий дней: site-content.ts помечен server-only, импортировать
// из него значение (formatDeliveryDaysLabel) в чистый модуль нельзя. Список стабилен.
const DAY_LABELS = [
  "воскресенье",
  "понедельник",
  "вторник",
  "среда",
  "четверг",
  "пятница",
  "суббота",
];

function formatDays(days: number[]): string {
  const label = days
    .slice()
    .sort((a, b) => (a === 0 ? 7 : a) - (b === 0 ? 7 : b))
    .map((d) => DAY_LABELS[d] ?? "")
    .filter(Boolean)
    .join(", ");
  return label || "по согласованию";
}

/**
 * Компактный блок актуальных бизнес-фактов для промпта агента. Значения — из
 * контента сайта (редактируется суперадмином) и единого тарифа доставки.
 */
export function buildBusinessContext(site: BusinessFacts): string {
  return [
    "БИЗНЕС-ДАННЫЕ (актуальные значения — бери отсюда, не выдумывай):",
    `- Часы работы: ${site.workHours}.`,
    `- Доставка по Алматы в дни: ${formatDays(site.deliveryDays)}. Приём заявок — до ${site.orderCutoffHour}:00 накануне дня доставки.`,
    `- ${describeDeliveryTariff()}`,
    `- Контакты: телефон ${site.contactPhone}, WhatsApp ${site.contactWhatsapp}, адрес: ${site.address}.`,
  ].join("\n");
}
