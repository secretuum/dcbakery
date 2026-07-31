// Безопасная проверка голосового ДО передачи в распознавание. Чистая функция:
// на вход — уже скачанные байты (доверенным путём провайдера) + заявленные
// метаданные; на выход — допускать/отклонять. Проверяем размер, длительность,
// разрешённый MIME и РЕАЛЬНЫЙ формат по magic-bytes (не доверяем заявленному типу).
// Файл нигде не исполняется и не конвертируется shell-командой.

import { LIMITS, ALLOWED_AUDIO_MIME } from "../config";

export type AudioFormat = "ogg" | "mp3" | "aac" | "mp4" | "wav" | "amr";

export type AudioGuardResult =
  | { ok: true; format: AudioFormat }
  | { ok: false; reason: string };

function startsWith(bytes: Uint8Array, sig: readonly number[], offset = 0): boolean {
  if (bytes.length < offset + sig.length) return false;
  for (let i = 0; i < sig.length; i++) {
    if (bytes[offset + i] !== sig[i]) return false;
  }
  return true;
}

/** Определить реальный формат аудио по сигнатуре (magic-bytes). null — не аудио. */
export function detectAudioFormat(bytes: Uint8Array): AudioFormat | null {
  if (startsWith(bytes, [0x4f, 0x67, 0x67, 0x53])) return "ogg"; // "OggS" (opus/vorbis)
  if (startsWith(bytes, [0x49, 0x44, 0x33])) return "mp3"; // "ID3"
  if (startsWith(bytes, [0x23, 0x21, 0x41, 0x4d, 0x52])) return "amr"; // "#!AMR"
  if (startsWith(bytes, [0x52, 0x49, 0x46, 0x46]) && startsWith(bytes, [0x57, 0x41, 0x56, 0x45], 8)) {
    return "wav"; // "RIFF"...."WAVE"
  }
  if (startsWith(bytes, [0x66, 0x74, 0x79, 0x70], 4)) return "mp4"; // ....ftyp (m4a/mp4)
  if (bytes.length >= 2 && bytes[0] === 0xff && (bytes[1] & 0xe0) === 0xe0) {
    // MPEG audio frame sync: отличаем ADTS AAC (0xFFF1/0xFFF9) от MP3-фрейма.
    if ((bytes[1] & 0xf6) === 0xf0) return "aac";
    return "mp3";
  }
  return null;
}

export type AudioGuardInput = {
  bytes: Uint8Array;
  mimeType?: string | null;
  durationSeconds?: number | null;
};

/** Допустить голосовое к распознаванию или отклонить с причиной. */
export function guardAudio(input: AudioGuardInput): AudioGuardResult {
  const size = input.bytes.byteLength;
  if (size <= 0) return { ok: false, reason: "empty" };
  if (size > LIMITS.maxVoiceBytes) return { ok: false, reason: "too_large" };

  if (input.durationSeconds != null && input.durationSeconds > LIMITS.maxVoiceSeconds) {
    return { ok: false, reason: "too_long" };
  }

  if (input.mimeType) {
    const base = input.mimeType.toLowerCase().split(";")[0].trim();
    if (base && !ALLOWED_AUDIO_MIME.has(base)) {
      return { ok: false, reason: "mime_not_allowed" };
    }
  }

  const format = detectAudioFormat(input.bytes);
  if (!format) return { ok: false, reason: "not_audio" };

  return { ok: true, format };
}
