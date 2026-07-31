import "server-only";
// Тонкая обёртка над OpenAI REST (уже используемый в проекте провайдер; ключ
// OPENAI_API_KEY). Только то, что нужно подсистеме: structured-JSON чат и Whisper.
// Явные таймауты, никаких секретов в логах, ошибки прокидываются вызывающему
// (там circuit-breaker / fallback на менеджера).

import { TIMEOUTS } from "../config";

const OPENAI_BASE = (process.env.OPENAI_API_BASE ?? "https://api.openai.com/v1").replace(/\/$/, "");

export function isOpenAiConfigured(): boolean {
  return Boolean(process.env.OPENAI_API_KEY);
}

function requireKey(): string {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error("OPENAI_API_KEY is not configured");
  return key;
}

/** Chat Completions со строгим json_schema (structured output). Возвращает распарсенный JSON. */
export async function openaiChatJson(params: {
  model: string;
  system: string;
  user: string;
  schema: unknown;
  schemaName: string;
  timeoutMs?: number;
}): Promise<unknown> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), params.timeoutMs ?? TIMEOUTS.intentMs);
  try {
    const res = await fetch(`${OPENAI_BASE}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${requireKey()}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: params.model,
        temperature: 0,
        messages: [
          { role: "system", content: params.system },
          { role: "user", content: params.user },
        ],
        response_format: {
          type: "json_schema",
          json_schema: { name: params.schemaName, strict: true, schema: params.schema },
        },
      }),
      signal: controller.signal,
      cache: "no-store",
    });

    if (!res.ok) {
      throw new Error(`OpenAI chat ${res.status}`);
    }

    const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
    const content = data.choices?.[0]?.message?.content;
    if (!content) throw new Error("OpenAI chat: empty content");
    return JSON.parse(content);
  } finally {
    clearTimeout(timer);
  }
}

/** Whisper-транскрибация. Возвращает текст и (по возможности) язык. */
export async function openaiTranscribe(params: {
  bytes: Uint8Array;
  filename: string;
  mimeType: string;
  model: string;
  timeoutMs?: number;
}): Promise<{ text: string; lang?: string }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), params.timeoutMs ?? TIMEOUTS.transcribeMs);
  try {
    // Копируем в свежий Uint8Array (тип с ArrayBuffer, а не ArrayBufferLike) —
    // так он корректно принимается Blob как BlobPart.
    const fileBytes = new Uint8Array(params.bytes.byteLength);
    fileBytes.set(params.bytes);

    const form = new FormData();
    form.append("file", new Blob([fileBytes], { type: params.mimeType }), params.filename);
    form.append("model", params.model);
    form.append("response_format", "verbose_json");

    const res = await fetch(`${OPENAI_BASE}/audio/transcriptions`, {
      method: "POST",
      headers: { Authorization: `Bearer ${requireKey()}` },
      body: form,
      signal: controller.signal,
      cache: "no-store",
    });

    if (!res.ok) {
      throw new Error(`OpenAI transcribe ${res.status}`);
    }

    const data = (await res.json()) as { text?: string; language?: string };
    return { text: (data.text ?? "").trim(), lang: data.language };
  } finally {
    clearTimeout(timer);
  }
}
