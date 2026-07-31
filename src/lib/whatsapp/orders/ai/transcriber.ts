import "server-only";
// Распознавание речи. Интерфейс Transcriber отделяет логику от конкретного STT —
// сейчас OpenAI Whisper (тот же OPENAI_API_KEY). Вход — уже ПРОВЕРЕННЫЕ аудиобайты
// (см. audio-guard); выход — текст как НЕДОВЕРЕННЫЕ данные для дальнейшего анализа.

import { TIMEOUTS } from "../config";
import { openaiTranscribe } from "./openai";

export type TranscriptionInput = {
  bytes: Uint8Array;
  mimeType: string;
  filename?: string;
};

export interface Transcriber {
  transcribe(input: TranscriptionInput): Promise<{ text: string; lang?: string }>;
}

const STT_MODEL = process.env.WHATSAPP_STT_MODEL ?? "whisper-1";

export class OpenAiWhisperTranscriber implements Transcriber {
  async transcribe(input: TranscriptionInput): Promise<{ text: string; lang?: string }> {
    return openaiTranscribe({
      bytes: input.bytes,
      filename: input.filename ?? "voice.ogg",
      mimeType: input.mimeType,
      model: STT_MODEL,
      timeoutMs: TIMEOUTS.transcribeMs,
    });
  }
}
