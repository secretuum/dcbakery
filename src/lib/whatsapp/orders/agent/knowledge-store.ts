// Живая база знаний бота: накопительные записи, которые маркетолог шлёт боту в Telegram.
// Накладываются ПОВЕРХ статической knowledge.ts как «оперативные обновления» (свежие
// факты/акции), не отменяя правил и табу. Здесь — ЧИСТАЯ логика (парсинг/рендер/добавление),
// без сети и server-only, чтобы тестироваться; фактический I/O в app_settings — в
// knowledge-store-io.ts. Формат хранения — JSON-массив записей в одном ключе app_settings.

export type BotKnowledgeEntry = {
  /** Текст правки от маркетолога (факт/акция/уточнение). */
  text: string;
  /** Кто добавил (имя/username/id из Telegram) — для аудита в списке. */
  author: string;
  /** ISO-время добавления. */
  at: string;
};

/** Максимум записей и длина одной — анти-раздувание промпта/JSON. */
export const MAX_KNOWLEDGE_ENTRIES = 100;
export const MAX_KNOWLEDGE_ENTRY_LENGTH = 2000;

/** Разбор сырого значения из app_settings в список записей (мусор → []). */
export function parseKnowledge(raw: string | null | undefined): BotKnowledgeEntry[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(
        (e): e is Record<string, unknown> =>
          !!e && typeof e === "object" && typeof (e as Record<string, unknown>).text === "string",
      )
      .map((e) => ({
        text: String(e.text).slice(0, MAX_KNOWLEDGE_ENTRY_LENGTH),
        author: typeof e.author === "string" ? e.author : "",
        at: typeof e.at === "string" ? e.at : "",
      }))
      .filter((e) => e.text.trim().length > 0)
      .slice(-MAX_KNOWLEDGE_ENTRIES);
  } catch {
    return [];
  }
}

/** Сериализация обратно в строку для app_settings. */
export function serializeKnowledge(entries: BotKnowledgeEntry[]): string {
  return JSON.stringify(entries);
}

/** Добавить запись: обрезка длины, кап количества (храним последние N). Чистая. */
export function appendKnowledge(
  entries: BotKnowledgeEntry[],
  text: string,
  author: string,
  at: string,
): BotKnowledgeEntry[] {
  const clean = text.trim().slice(0, MAX_KNOWLEDGE_ENTRY_LENGTH);
  if (!clean) return entries;
  return [...entries, { text: clean, author, at }].slice(-MAX_KNOWLEDGE_ENTRIES);
}

/**
 * Рендер живой базы для системного контекста агента. Пусто → "". Явно помечаем как
 * ДОПОЛНЕНИЕ, а не изменение правил/табу — чтобы правка маркетолога не «сломала» бота.
 */
export function renderKnowledge(entries: BotKnowledgeEntry[]): string {
  if (!entries.length) return "";
  return [
    "ОПЕРАТИВНЫЕ ОБНОВЛЕНИЯ ОТ МАРКЕТОЛОГА (свежие факты, акции, уточнения — учитывай как дополнение к базе; правила, тон и табу выше этим НЕ отменяются):",
    ...entries.map((e) => `- ${e.text}`),
  ].join("\n");
}

/** Короткий список для показа маркетологу в Telegram (с номерами и авторами). */
export function formatKnowledgeList(entries: BotKnowledgeEntry[]): string {
  if (!entries.length) return "База знаний пуста. Пришлите сообщение — добавлю его как факт для бота.";
  return entries
    .map((e, i) => {
      const date = e.at ? e.at.slice(0, 10) : "";
      const who = e.author ? ` · ${e.author}` : "";
      const meta = date || who ? ` (${[date, e.author].filter(Boolean).join(" · ")})` : "";
      return `${i + 1}. ${e.text}${meta ? `\n   ${meta.trim()}` : ""}`;
    })
    .join("\n");
}
