// Рендер статистики бота для Telegram (маркетологу/админу). Чистая функция — тестируется;
// сами цифры собирает bot-stats.ts (запросы к Supabase). Формат тенге — «1 000» (пробел
// в тысячах), как просил владелец. Без эмодзи (внутреннее сообщение, стиль как у бота).

export type BotStats = {
  /** Заказы через бота (source=whatsapp) за 7 / 30 дней: количество и сумма (позиции+доставка). */
  orders7d: number;
  orders30d: number;
  revenue7d: number;
  revenue30d: number;
  /** Диалоги с активностью за 7 / 30 дней (whatsapp_dialog_state.last_activity_at). */
  dialogs7d: number;
  dialogs30d: number;
  /** Сейчас передано менеджеру (state=human_handoff). */
  handoffOpen: number;
  /** Сейчас открытых обращений к менеджеру (whatsapp_lead_drafts.status=open). */
  leadsOpen: number;
};

/** «10000» → «10 000». */
export function formatTenge(value: number): string {
  const n = Math.round(Number.isFinite(value) ? value : 0);
  return `${n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ")} ₸`;
}

export function formatBotStats(s: BotStats): string {
  return [
    "Статистика бота",
    "",
    "За 7 дней:",
    `• Диалогов: ${s.dialogs7d}`,
    `• Заказов через бота: ${s.orders7d} на ${formatTenge(s.revenue7d)}`,
    "",
    "За 30 дней:",
    `• Диалогов: ${s.dialogs30d}`,
    `• Заказов через бота: ${s.orders30d} на ${formatTenge(s.revenue30d)}`,
    "",
    "Сейчас:",
    `• Передано менеджеру (в работе): ${s.handoffOpen}`,
    `• Открытых обращений к менеджеру: ${s.leadsOpen}`,
  ].join("\n");
}
