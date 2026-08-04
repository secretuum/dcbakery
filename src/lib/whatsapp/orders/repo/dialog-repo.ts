import "server-only";
// Персистентное состояние диалога (state-machine) + оптимистичная блокировка от
// параллельной обработки двух сообщений одного чата.

import type { DialogState } from "../state/machine";
import { getRepoConfig, repoHeaders, repoFetch } from "./client";

export type DialogRow = {
  chatId: string;
  phone: string | null;
  state: DialogState;
  context: Record<string, unknown>;
  handoffReason: string | null;
  lockedUntil: string | null;
  lockToken: string | null;
  lastActivityAt: string;
};

type RawDialogRow = {
  chat_id: string;
  phone: string | null;
  state: string;
  context: unknown;
  handoff_reason: string | null;
  locked_until: string | null;
  lock_token: string | null;
  last_activity_at: string;
};

function toRow(raw: RawDialogRow): DialogRow {
  return {
    chatId: raw.chat_id,
    phone: raw.phone,
    state: raw.state as DialogState,
    context: raw.context && typeof raw.context === "object" ? (raw.context as Record<string, unknown>) : {},
    handoffReason: raw.handoff_reason,
    lockedUntil: raw.locked_until,
    lockToken: raw.lock_token,
    lastActivityAt: raw.last_activity_at,
  };
}

export async function getDialog(chatId: string): Promise<DialogRow | null> {
  const config = getRepoConfig();
  const params = new URLSearchParams({ chat_id: `eq.${chatId}`, limit: "1", select: "*" });
  const res = await repoFetch(`${config.restUrl}/whatsapp_dialog_state?${params}`, {
    headers: repoHeaders(config.serviceRoleKey),
  });
  if (!res.ok) throw new Error(`getDialog failed: ${res.status}`);
  const rows = (await res.json()) as RawDialogRow[];
  return rows[0] ? toRow(rows[0]) : null;
}

/** Upsert состояния/контекста. Обновляет last_activity_at. */
export async function saveDialog(input: {
  chatId: string;
  phone?: string | null;
  state: DialogState;
  context?: Record<string, unknown>;
  handoffReason?: string | null;
  nowIso: string;
}): Promise<void> {
  const config = getRepoConfig();
  const res = await repoFetch(`${config.restUrl}/whatsapp_dialog_state?on_conflict=chat_id`, {
    method: "POST",
    headers: repoHeaders(config.serviceRoleKey, "resolution=merge-duplicates,return=minimal"),
    body: JSON.stringify({
      chat_id: input.chatId,
      phone: input.phone ?? null,
      state: input.state,
      context: input.context ?? {},
      handoff_reason: input.handoffReason ?? null,
      last_activity_at: input.nowIso,
    }),
  });
  if (!res.ok) throw new Error(`saveDialog failed: ${res.status}`);
}

/**
 * Попытаться захватить блокировку чата на lease-срок. Атомарно: PATCH проходит
 * только если строка свободна (locked_until пуст/в прошлом). Возвращает true при успехе.
 * Строка должна существовать (создаётся saveDialog при старте диалога).
 */
export async function acquireDialogLock(
  chatId: string,
  lockToken: string,
  nowIso: string,
  leaseUntilIso: string,
): Promise<boolean> {
  const config = getRepoConfig();
  const params = new URLSearchParams({
    chat_id: `eq.${chatId}`,
    or: `(locked_until.is.null,locked_until.lt.${nowIso})`,
  });
  const res = await repoFetch(`${config.restUrl}/whatsapp_dialog_state?${params}`, {
    method: "PATCH",
    headers: repoHeaders(config.serviceRoleKey, "return=representation"),
    body: JSON.stringify({ lock_token: lockToken, locked_until: leaseUntilIso }),
  });
  if (!res.ok) throw new Error(`acquireDialogLock failed: ${res.status}`);
  const rows = (await res.json()) as unknown[];
  return Array.isArray(rows) && rows.length > 0;
}

export async function releaseDialogLock(chatId: string, lockToken: string): Promise<void> {
  const config = getRepoConfig();
  const params = new URLSearchParams({ chat_id: `eq.${chatId}`, lock_token: `eq.${lockToken}` });
  await repoFetch(`${config.restUrl}/whatsapp_dialog_state?${params}`, {
    method: "PATCH",
    headers: repoHeaders(config.serviceRoleKey, "return=minimal"),
    body: JSON.stringify({ lock_token: null, locked_until: null }),
  }).catch(() => undefined);
}
