import "server-only";
// Общий доступ к Supabase через service role (тот же паттерн, что payments-store.ts /
// whatsapp-cart-store.ts) — намеренно НЕ добавляем эти запросы в src/lib/supabase/admin.ts
// (запретная зона). Явный таймаут на каждый вызов.

import { TIMEOUTS } from "../config";

export type RepoConfig = { restUrl: string; storageUrl: string; serviceRoleKey: string };

export function getRepoConfig(): RepoConfig {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) {
    throw new Error("Supabase admin credentials are not configured");
  }
  const base = url.replace(/\/$/, "");
  return { restUrl: `${base}/rest/v1`, storageUrl: `${base}/storage/v1`, serviceRoleKey };
}

export function repoHeaders(serviceRoleKey: string, prefer?: string): Record<string, string> {
  const headers: Record<string, string> = {
    apikey: serviceRoleKey,
    Authorization: `Bearer ${serviceRoleKey}`,
    "Content-Type": "application/json",
  };
  if (prefer) headers.Prefer = prefer;
  return headers;
}

/** fetch с таймаутом и no-store (для REST/Storage Supabase). */
export async function repoFetch(url: string, init: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUTS.supabaseMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal, cache: "no-store" });
  } finally {
    clearTimeout(timer);
  }
}
