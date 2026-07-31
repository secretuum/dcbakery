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

/**
 * Оценка длительности OGG/Opus по granule-позициям страниц (WhatsApp voice = opus в ogg).
 * Opus считает granule в единицах 48 кГц → duration ≈ maxGranule / 48000. null — не разобрать.
 * Нужна, т.к. Green API не присылает длительность в webhook.
 */
export function estimateOggOpusDurationSeconds(bytes: Uint8Array): number | null {
  let maxGranule = -1;
  let i = 0;
  while (i + 27 <= bytes.length) {
    if (bytes[i] === 0x4f && bytes[i + 1] === 0x67 && bytes[i + 2] === 0x67 && bytes[i + 3] === 0x53) {
      let granule = 0;
      for (let b = 0; b < 8; b++) granule += bytes[i + 6 + b] * 2 ** (8 * b);
      if (granule > maxGranule) maxGranule = granule;
      const nsegs = bytes[i + 26];
      if (i + 27 + nsegs > bytes.length) break;
      let bodyLen = 0;
      for (let s = 0; s < nsegs; s++) bodyLen += bytes[i + 27 + s];
      i = i + 27 + nsegs + bodyLen;
    } else {
      i += 1;
    }
  }
  if (maxGranule <= 0) return null;
  return maxGranule / 48000;
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

  if (input.mimeType) {
    const base = input.mimeType.toLowerCase().split(";")[0].trim();
    if (base && !ALLOWED_AUDIO_MIME.has(base)) {
      return { ok: false, reason: "mime_not_allowed" };
    }
  }

  const format = detectAudioFormat(input.bytes);
  if (!format) return { ok: false, reason: "not_audio" };

  // Длительность: заявленная провайдером И вычисленная из ogg — берём максимум.
  const computed = format === "ogg" ? estimateOggOpusDurationSeconds(input.bytes) : null;
  const duration = Math.max(input.durationSeconds ?? 0, computed ?? 0);
  if (duration > LIMITS.maxVoiceSeconds) return { ok: false, reason: "too_long" };

  return { ok: true, format };
}
