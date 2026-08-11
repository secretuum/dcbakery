import "server-only";
// Серверный I/O живой базы знаний бота: чтение (кэшируется на инстанс, как site_content —
// бот дёргает её на каждое сообщение) и запись (маркетолог из Telegram). Пишем в один
// ключ app_settings через существующий upsertAppSetting (миграций не требуется). При
// записи сбрасываем кэш через revalidateTag, чтобы правка применилась сразу.

import { unstable_cache, revalidateTag } from "next/cache";
import { fetchAppSetting, upsertAppSetting } from "@/src/lib/supabase/admin";
import { BOT_KNOWLEDGE_SETTING } from "../config";
import {
  parseKnowledge,
  serializeKnowledge,
  appendKnowledge,
  type BotKnowledgeEntry,
} from "./knowledge-store";

export const BOT_KNOWLEDGE_CACHE_TAG = "whatsapp-bot-knowledge";

const loadKnowledge = unstable_cache(
  async (): Promise<BotKnowledgeEntry[]> => {
    const raw = await fetchAppSetting(BOT_KNOWLEDGE_SETTING).catch(() => null);
    return parseKnowledge(raw);
  },
  ["whatsapp-bot-knowledge-v1"],
  { revalidate: 3600, tags: [BOT_KNOWLEDGE_CACHE_TAG] },
);

/** Текущие записи живой базы (кэш). Ошибка → пустой список (бот работает на статике). */
export async function getBotKnowledgeEntries(): Promise<BotKnowledgeEntry[]> {
  try {
    return await loadKnowledge();
  } catch {
    return [];
  }
}

/** Добавить запись от маркетолога и сбросить кэш. Возвращает новый размер базы. */
export async function appendBotKnowledgeEntry(text: string, author: string, nowIso: string): Promise<number> {
  const current = parseKnowledge(await fetchAppSetting(BOT_KNOWLEDGE_SETTING).catch(() => null));
  const next = appendKnowledge(current, text, author, nowIso);
  await upsertAppSetting(BOT_KNOWLEDGE_SETTING, serializeKnowledge(next));
  revalidateTag(BOT_KNOWLEDGE_CACHE_TAG, "max");
  return next.length;
}

/** Очистить живую базу (маркетолог). Статическая knowledge.ts не затрагивается. */
export async function clearBotKnowledge(): Promise<void> {
  await upsertAppSetting(BOT_KNOWLEDGE_SETTING, serializeKnowledge([]));
  revalidateTag(BOT_KNOWLEDGE_CACHE_TAG, "max");
}
