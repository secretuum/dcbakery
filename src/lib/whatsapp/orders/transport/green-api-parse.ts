// Чистый разбор входящего webhook Green API в нормализованное сообщение — без сети/БД,
// поэтому тестируется. Отделено от green-api.ts (server-only), где живут send/download.

import type { NormalizedIncomingMessage } from "./types";

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null;
}
function asRecord(v: unknown): Record<string, unknown> {
  return isRecord(v) ? v : {};
}
function asString(v: unknown): string {
  return typeof v === "string" ? v : "";
}

/**
 * Хост доверенного файлового хранилища Green API (защита от SSRF при скачивании).
 * Green API использует два домена: старый `green-api.com` и новый `greenapi.com`
 * (per-host, напр. `7105.media.greenapi.com`) — разрешаем оба.
 */
export function isTrustedGreenHost(url: string): boolean {
  try {
    const host = new URL(url).hostname.toLowerCase();
    return (
      host === "green-api.com" ||
      host.endsWith(".green-api.com") ||
      host === "greenapi.com" ||
      host.endsWith(".greenapi.com")
    );
  } catch {
    return false;
  }
}

function digitsOf(chatId: string): string {
  return chatId.split("@")[0]?.replace(/\D/g, "") ?? "";
}

export type GreenParseConfig = { managerChatId?: string | null };

/** Нормализовать payload Green API. null — событие не является входящим сообщением. */
export function normalizeGreenWebhook(
  payload: unknown,
  config: GreenParseConfig = {},
): NormalizedIncomingMessage | null {
  if (!isRecord(payload)) return null;
  if (payload.typeWebhook !== "incomingMessageReceived") return null;

  const senderData = asRecord(payload.senderData);
  const chatId = asString(senderData.chatId);
  if (!chatId) return null;

  const messageId = asString(payload.idMessage);
  if (!messageId) return null;

  const phone = digitsOf(chatId);
  const managerChatId = config.managerChatId ?? "";
  const isManagerChat = (Boolean(managerChatId) && chatId === managerChatId) || chatId.endsWith("@g.us");

  const messageData = asRecord(payload.messageData);
  const typeMessage = asString(messageData.typeMessage);
  const profileName = asString(senderData.senderName) || null;

  const base = {
    messageId,
    phone,
    chatId,
    profileName,
    isManagerChat,
  };

  if (typeMessage === "textMessage") {
    return { ...base, kind: "text", text: asString(asRecord(messageData.textMessageData).textMessage) };
  }
  if (typeMessage === "extendedTextMessage") {
    return { ...base, kind: "text", text: asString(asRecord(messageData.extendedTextMessageData).text) };
  }
  if (typeMessage === "audioMessage") {
    const file = asRecord(messageData.fileMessageData);
    const downloadUrl = asString(file.downloadUrl);
    return {
      ...base,
      kind: "voice",
      voice: {
        downloadUrl: downloadUrl || null,
        mimeType: asString(file.mimeType) || null,
        sizeBytes: null,
        durationSeconds: null,
      },
    };
  }

  // Геометка клиента: координаты + (если подписал) название/адрес.
  if (typeMessage === "locationMessage") {
    const loc = asRecord(messageData.locationMessageData);
    return {
      ...base,
      kind: "location",
      location: {
        latitude: Number(loc.latitude),
        longitude: Number(loc.longitude),
        name: asString(loc.nameLocation) || null,
        address: asString(loc.address) || null,
      },
    };
  }

  // Фото и документы — читаем (OCR для фото/PDF, exceljs для Excel). У обоих типов
  // файл лежит в fileMessageData (downloadUrl/mimeType/fileName/caption).
  if (typeMessage === "imageMessage" || typeMessage === "documentMessage") {
    const file = asRecord(messageData.fileMessageData);
    return {
      ...base,
      kind: typeMessage === "imageMessage" ? "image" : "document",
      media: {
        downloadUrl: asString(file.downloadUrl) || null,
        mimeType: asString(file.mimeType) || null,
        fileName: asString(file.fileName) || null,
        caption: asString(file.caption) || null,
        sizeBytes: null,
      },
    };
  }

  // Видео, стикеры, контакты, гео и т.п. — не обрабатываем.
  return { ...base, kind: "unsupported" };
}
