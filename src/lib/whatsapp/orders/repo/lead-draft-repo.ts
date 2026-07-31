import "server-only";
// Черновики лида для менеджера (одна активная запись на чат, upsert по chat_id).
// Уходит в СУЩЕСТВУЮЩИЙ Telegram-чат менеджеров (второй канал не создаём).

import { getRepoConfig, repoHeaders, repoFetch } from "./client";

export type LeadDraftInput = {
  chatId: string;
  phone?: string | null;
  provisionalName?: string | null;
  cart?: Array<{ productId: string; qty: number }>;
  address?: string | null;
  deliveryPeriod?: string | null;
  stage?: string | null;
  reason?: string | null;
  lastVoiceTranscript?: string | null;
  telegramMessageId?: string | null;
};

export async function upsertLeadDraft(input: LeadDraftInput): Promise<void> {
  const config = getRepoConfig();
  const body: Record<string, unknown> = {
    chat_id: input.chatId,
    status: "open",
  };
  if (input.phone !== undefined) body.phone = input.phone;
  if (input.provisionalName !== undefined) body.provisional_name = input.provisionalName;
  if (input.cart !== undefined) body.cart = input.cart;
  if (input.address !== undefined) body.address = input.address;
  if (input.deliveryPeriod !== undefined) body.delivery_period = input.deliveryPeriod;
  if (input.stage !== undefined) body.stage = input.stage;
  if (input.reason !== undefined) body.reason = input.reason;
  if (input.lastVoiceTranscript !== undefined) body.last_voice_transcript = input.lastVoiceTranscript;
  if (input.telegramMessageId !== undefined) body.telegram_message_id = input.telegramMessageId;

  const res = await repoFetch(`${config.restUrl}/whatsapp_lead_drafts?on_conflict=chat_id`, {
    method: "POST",
    headers: repoHeaders(config.serviceRoleKey, "resolution=merge-duplicates,return=minimal"),
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`upsertLeadDraft failed: ${res.status}`);
}

export async function closeLeadDraft(chatId: string): Promise<void> {
  const config = getRepoConfig();
  await repoFetch(`${config.restUrl}/whatsapp_lead_drafts?chat_id=eq.${encodeURIComponent(chatId)}`, {
    method: "PATCH",
    headers: repoHeaders(config.serviceRoleKey, "return=minimal"),
    body: JSON.stringify({ status: "closed" }),
  }).catch(() => undefined);
}
