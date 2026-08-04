import "server-only";
// Журнал согласий (append-only): версия текста, номер, id сообщения-подтверждения, время.

import { getRepoConfig, repoHeaders, repoFetch } from "./client";

export async function recordConsent(input: {
  phone: string;
  chatId?: string | null;
  version: string;
  source?: string;
  messageId?: string | null;
  acceptedAtIso: string;
}): Promise<void> {
  const config = getRepoConfig();
  const res = await repoFetch(`${config.restUrl}/whatsapp_consents`, {
    method: "POST",
    headers: repoHeaders(config.serviceRoleKey, "return=minimal"),
    body: JSON.stringify({
      phone: input.phone,
      chat_id: input.chatId ?? null,
      consent_version: input.version,
      source: input.source ?? "whatsapp",
      message_id: input.messageId ?? null,
      accepted_at: input.acceptedAtIso,
    }),
  });
  if (!res.ok) throw new Error(`recordConsent failed: ${res.status}`);
}

/** Есть ли уже согласие данной версии для номера. */
export async function hasConsent(phone: string, version: string): Promise<boolean> {
  const config = getRepoConfig();
  const params = new URLSearchParams({
    phone: `eq.${phone}`,
    consent_version: `eq.${version}`,
    limit: "1",
    select: "id",
  });
  const res = await repoFetch(`${config.restUrl}/whatsapp_consents?${params}`, {
    headers: repoHeaders(config.serviceRoleKey),
  });
  if (!res.ok) throw new Error(`hasConsent failed: ${res.status}`);
  const rows = (await res.json()) as unknown[];
  return Array.isArray(rows) && rows.length > 0;
}
