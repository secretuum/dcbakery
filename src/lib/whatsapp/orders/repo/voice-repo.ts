import "server-only";
// Голосовые: сам файл — в ПРИВАТНЫЙ бакет Storage (whatsapp-voice), в таблице —
// метаданные + расшифровка. Прямых открытых ссылок не публикуем.

import { getRepoConfig, repoHeaders, repoFetch } from "./client";

/** Загрузить аудиофайл в приватный бакет. Возвращает путь объекта. */
export async function uploadVoiceObject(
  path: string,
  bytes: Uint8Array,
  mimeType: string,
): Promise<string> {
  const config = getRepoConfig();
  // Копия в свежий Uint8Array (ArrayBuffer, не ArrayBufferLike) — корректный BodyInit.
  const payload = new Uint8Array(bytes.byteLength);
  payload.set(bytes);
  const res = await repoFetch(`${config.storageUrl}/object/whatsapp-voice/${path}`, {
    method: "POST",
    headers: {
      apikey: config.serviceRoleKey,
      Authorization: `Bearer ${config.serviceRoleKey}`,
      "Content-Type": mimeType || "application/octet-stream",
      "x-upsert": "true",
    },
    body: payload,
  });
  if (!res.ok) throw new Error(`uploadVoiceObject failed: ${res.status}`);
  return path;
}

export async function insertVoiceMessage(input: {
  chatId: string;
  phone?: string | null;
  messageId?: string | null;
  storagePath?: string | null;
  mimeType?: string | null;
  sizeBytes?: number | null;
  durationSeconds?: number | null;
  transcript?: string | null;
  transcriptLang?: string | null;
  status: string;
  rejectReason?: string | null;
}): Promise<string> {
  const config = getRepoConfig();
  const res = await repoFetch(`${config.restUrl}/whatsapp_voice_messages`, {
    method: "POST",
    headers: repoHeaders(config.serviceRoleKey, "return=representation"),
    body: JSON.stringify({
      chat_id: input.chatId,
      phone: input.phone ?? null,
      message_id: input.messageId ?? null,
      storage_path: input.storagePath ?? null,
      mime_type: input.mimeType ?? null,
      size_bytes: input.sizeBytes ?? null,
      duration_seconds: input.durationSeconds ?? null,
      transcript: input.transcript ?? null,
      transcript_lang: input.transcriptLang ?? null,
      status: input.status,
      reject_reason: input.rejectReason ?? null,
    }),
  });
  if (!res.ok) throw new Error(`insertVoiceMessage failed: ${res.status}`);
  const rows = (await res.json()) as Array<{ id: string }>;
  return rows[0]?.id ?? "";
}

export async function updateVoiceTranscript(
  id: string,
  patch: { transcript?: string; transcriptLang?: string | null; status?: string; rejectReason?: string | null },
): Promise<void> {
  const config = getRepoConfig();
  const body: Record<string, unknown> = {};
  if (patch.transcript !== undefined) body.transcript = patch.transcript;
  if (patch.transcriptLang !== undefined) body.transcript_lang = patch.transcriptLang;
  if (patch.status !== undefined) body.status = patch.status;
  if (patch.rejectReason !== undefined) body.reject_reason = patch.rejectReason;

  await repoFetch(`${config.restUrl}/whatsapp_voice_messages?id=eq.${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: repoHeaders(config.serviceRoleKey, "return=minimal"),
    body: JSON.stringify(body),
  }).catch(() => undefined);
}
