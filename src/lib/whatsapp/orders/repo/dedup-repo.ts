import "server-only";
// Дедупликация входящих сообщений (идемпотентность webhook). Атомарно через
// ON CONFLICT DO NOTHING по PK message_id: если строка вставилась — сообщение новое.

import { getRepoConfig, repoHeaders, repoFetch } from "./client";

/**
 * Пометить сообщение обработанным.
 * @returns true — сообщение ВПЕРВЫЕ (обрабатывать); false — дубль (игнорировать).
 */
export async function markMessageProcessed(
  messageId: string,
  meta?: { chatId?: string | null; kind?: string | null },
): Promise<boolean> {
  const config = getRepoConfig();
  const res = await repoFetch(`${config.restUrl}/whatsapp_processed_messages?on_conflict=message_id`, {
    method: "POST",
    headers: repoHeaders(config.serviceRoleKey, "return=representation,resolution=ignore-duplicates"),
    body: JSON.stringify({
      message_id: messageId,
      chat_id: meta?.chatId ?? null,
      kind: meta?.kind ?? null,
    }),
  });

  if (!res.ok) {
    throw new Error(`dedup insert failed: ${res.status}`);
  }

  // ignore-duplicates: при конфликте ничего не вставляется → пустой массив.
  const rows = (await res.json()) as unknown[];
  return Array.isArray(rows) && rows.length > 0;
}

/** Записать итог обработки сообщения (для наблюдаемости; ошибки не критичны). */
export async function setMessageOutcome(messageId: string, outcome: string): Promise<void> {
  const config = getRepoConfig();
  await repoFetch(
    `${config.restUrl}/whatsapp_processed_messages?message_id=eq.${encodeURIComponent(messageId)}`,
    {
      method: "PATCH",
      headers: repoHeaders(config.serviceRoleKey, "return=minimal"),
      body: JSON.stringify({ outcome }),
    },
  ).catch(() => undefined);
}
