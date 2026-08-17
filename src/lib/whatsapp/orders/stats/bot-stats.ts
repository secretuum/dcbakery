import "server-only";
// Сбор статистики бота из Supabase (service role, тот же паттерн repoFetch, что и
// репозитории — НЕ через запретный admin.ts). Считаем count через PostgREST
// Prefer: count=exact (заголовок Content-Range "0-0/TOTAL"), сумму заказов — выборкой
// сумм за период. Каждый запрос гасит ошибку в 0, чтобы статистика не падала целиком.

import { getRepoConfig, repoHeaders, repoFetch, type RepoConfig } from "../repo/client";
import type { BotStats } from "./bot-stats-format";

const DAY_MS = 24 * 60 * 60 * 1000;

/** Точный count строк по фильтру (PostgREST count=exact → Content-Range). */
async function countRows(config: RepoConfig, pathWithQuery: string): Promise<number> {
  try {
    const res = await repoFetch(`${config.restUrl}/${pathWithQuery}`, {
      method: "GET",
      headers: repoHeaders(config.serviceRoleKey, "count=exact"),
    });
    const total = res.headers.get("content-range")?.split("/")[1];
    const n = total ? Number(total) : NaN;
    return Number.isFinite(n) ? n : 0;
  } catch {
    return 0;
  }
}

/** Кол-во и сумма заказов через бота (source=whatsapp) с даты. */
async function ordersSince(config: RepoConfig, sinceIso: string): Promise<{ count: number; sum: number }> {
  try {
    const q = `orders?source=eq.whatsapp&created_at=gte.${sinceIso}&select=total_amount,delivery_amount&limit=5000`;
    const res = await repoFetch(`${config.restUrl}/${q}`, {
      method: "GET",
      headers: repoHeaders(config.serviceRoleKey),
    });
    if (!res.ok) return { count: 0, sum: 0 };
    const rows = (await res.json()) as Array<{ total_amount: number | null; delivery_amount: number | null }>;
    const sum = rows.reduce((acc, r) => acc + Number(r.total_amount ?? 0) + Number(r.delivery_amount ?? 0), 0);
    return { count: rows.length, sum };
  } catch {
    return { count: 0, sum: 0 };
  }
}

/** Собрать статистику бота на момент nowMs. */
export async function getBotStats(nowMs: number): Promise<BotStats> {
  const config = getRepoConfig();
  const iso7 = new Date(nowMs - 7 * DAY_MS).toISOString();
  const iso30 = new Date(nowMs - 30 * DAY_MS).toISOString();

  const [r7, r30, dialogs7d, dialogs30d, handoffOpen, leadsOpen] = await Promise.all([
    ordersSince(config, iso7),
    ordersSince(config, iso30),
    countRows(config, `whatsapp_dialog_state?last_activity_at=gte.${iso7}&select=chat_id&limit=1`),
    countRows(config, `whatsapp_dialog_state?last_activity_at=gte.${iso30}&select=chat_id&limit=1`),
    countRows(config, `whatsapp_dialog_state?state=eq.human_handoff&select=chat_id&limit=1`),
    countRows(config, `whatsapp_lead_drafts?status=eq.open&select=chat_id&limit=1`),
  ]);

  return {
    orders7d: r7.count,
    orders30d: r30.count,
    revenue7d: r7.sum,
    revenue30d: r30.sum,
    dialogs7d,
    dialogs30d,
    handoffOpen,
    leadsOpen,
  };
}
