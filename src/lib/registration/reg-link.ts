import "server-only";
// Одноразовая регистрационная ссылка. Криптостойкий токен, в БД — только его ХЭШ
// (sha256). Погашение атомарно (UPDATE проходит только если used=false и не истёк).
// Сессию по клику НЕ выдаём — ссылка лишь подтверждает номер и предзаполняет форму.
// Перенесено из бывшего модуля whatsapp/orders при удалении WhatsApp-заказов.

import { createHash, randomBytes } from "node:crypto";
import { getRepoConfig, repoHeaders, repoFetch } from "./repo-client";

const TTL_MS = 30 * 60 * 1000; // 30 минут

function hashToken(raw: string): string {
  return createHash("sha256").update(raw).digest("hex");
}

function siteBaseUrl(): string {
  return (process.env.NEXT_PUBLIC_SITE_URL ?? "https://dc-bakery.kz").replace(/\/$/, "");
}

/**
 * Создать одноразовую ссылку регистрации для номера. Возвращает URL (в нём — сырой
 * токен; в БД лежит только хэш) или null при сбое.
 */
export async function createRegistrationLink(phone: string, nowMs: number): Promise<string | null> {
  const config = getRepoConfig();
  const raw = randomBytes(32).toString("base64url");
  const expiresAt = new Date(nowMs + TTL_MS).toISOString();

  const res = await repoFetch(`${config.restUrl}/whatsapp_registration_tokens`, {
    method: "POST",
    headers: repoHeaders(config.serviceRoleKey, "return=minimal"),
    body: JSON.stringify({ phone, token_hash: hashToken(raw), expires_at: expiresAt }),
  });
  if (!res.ok) return null;

  return `${siteBaseUrl()}/register?rt=${raw}`;
}

/**
 * Прочитать токен БЕЗ гашения (для предзаполнения формы на GET-рендере — чтобы
 * префетч/предпросмотр ссылки не «сжёг» одноразовый токен). Возвращает номер или null.
 */
export async function peekRegistrationToken(
  raw: string,
  nowIso: string,
): Promise<{ phone: string } | null> {
  if (!raw || raw.length < 16) return null;
  const config = getRepoConfig();
  const params = new URLSearchParams({
    token_hash: `eq.${hashToken(raw)}`,
    used: "eq.false",
    expires_at: `gt.${nowIso}`,
    select: "phone",
    limit: "1",
  });
  const res = await repoFetch(`${config.restUrl}/whatsapp_registration_tokens?${params}`, {
    headers: repoHeaders(config.serviceRoleKey),
  });
  if (!res.ok) return null;
  const rows = (await res.json()) as Array<{ phone: string }>;
  return rows[0] ? { phone: rows[0].phone } : null;
}

/**
 * Погасить токен: атомарно помечает used=true ТОЛЬКО если он ещё не использован и не
 * истёк. Возвращает номер телефона или null (невалиден/просрочен/повторное использование).
 */
export async function consumeRegistrationToken(
  raw: string,
  nowIso: string,
): Promise<{ phone: string } | null> {
  if (!raw || raw.length < 16) return null;
  const config = getRepoConfig();
  const params = new URLSearchParams({
    token_hash: `eq.${hashToken(raw)}`,
    used: "eq.false",
    expires_at: `gt.${nowIso}`,
  });

  const res = await repoFetch(`${config.restUrl}/whatsapp_registration_tokens?${params}`, {
    method: "PATCH",
    headers: repoHeaders(config.serviceRoleKey, "return=representation"),
    body: JSON.stringify({ used: true, used_at: nowIso }),
  });
  if (!res.ok) return null;

  const rows = (await res.json()) as Array<{ phone: string }>;
  return rows[0] ? { phone: rows[0].phone } : null;
}
