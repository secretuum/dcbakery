import "server-only";
// Распознавание текста на фото/PDF через Yandex Vision OCR (sync recognizeText).
// Отдельный провайдер (ключ YANDEX_OCR_API_KEY + каталог YANDEX_OCR_FOLDER_ID). Вход —
// уже СКАЧАННЫЕ и ПРОВЕРЕННЫЕ байты (media-guard), выход — текст как НЕДОВЕРЕННЫЕ данные.
// Формат ответа парсим защитно (может прийти одним JSON или по строке на страницу).

import { TIMEOUTS } from "../config";
import { extractOcrText } from "./ocr-parse";

const OCR_BASE = (process.env.YANDEX_OCR_BASE ?? "https://ocr.api.cloud.yandex.net").replace(/\/$/, "");

export function isYandexOcrConfigured(): boolean {
  return Boolean(process.env.YANDEX_OCR_API_KEY && process.env.YANDEX_OCR_FOLDER_ID);
}

/** Распознать текст. mimeType — строго image/jpeg | image/png | application/pdf. */
export async function recognizeText(params: {
  bytes: Uint8Array;
  mimeType: "image/jpeg" | "image/png" | "application/pdf";
  timeoutMs?: number;
}): Promise<string> {
  const key = process.env.YANDEX_OCR_API_KEY;
  const folderId = process.env.YANDEX_OCR_FOLDER_ID;
  if (!key || !folderId) throw new Error("Yandex OCR is not configured");

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), params.timeoutMs ?? TIMEOUTS.transcribeMs);
  try {
    const content = Buffer.from(params.bytes).toString("base64");
    const res = await fetch(`${OCR_BASE}/ocr/v1/recognizeText`, {
      method: "POST",
      headers: {
        Authorization: `Api-Key ${key}`,
        "x-folder-id": folderId,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        mimeType: params.mimeType,
        languageCodes: ["ru", "en"],
        model: "page",
        content,
      }),
      signal: controller.signal,
      cache: "no-store",
    });
    if (!res.ok) throw new Error(`Yandex OCR ${res.status}`);
    return extractOcrText(await res.text());
  } finally {
    clearTimeout(timer);
  }
}
