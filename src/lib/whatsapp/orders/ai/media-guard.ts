// Безопасная проверка входящего фото/документа ДО чтения. Чистая функция: определяем
// РЕАЛЬНЫЙ формат по magic-bytes (не доверяем заявленному mime), проверяем размер и
// решаем, чем читать. Excel (zip) распознаётся по magic PK + подтверждается mime/именем
// файла (docx/pptx — тоже zip, их не читаем). Файл нигде не исполняется/не конвертируется.

/** Как читать медиа: image/pdf → OCR, xlsx → exceljs, unknown → не читаем. */
export type MediaKind = "image" | "pdf" | "xlsx" | "unknown";

export type MediaGuardInput = {
  bytes: Uint8Array;
  mimeType?: string | null;
  fileName?: string | null;
  maxBytes: number;
};

export type MediaGuardResult = { ok: true; kind: Exclude<MediaKind, "unknown"> } | { ok: false; reason: string };

function startsWith(bytes: Uint8Array, sig: readonly number[], offset = 0): boolean {
  if (bytes.length < offset + sig.length) return false;
  for (let i = 0; i < sig.length; i++) {
    if (bytes[offset + i] !== sig[i]) return false;
  }
  return true;
}

const JPEG = [0xff, 0xd8, 0xff];
const PNG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const PDF = [0x25, 0x50, 0x44, 0x46]; // "%PDF"
const ZIP = [0x50, 0x4b, 0x03, 0x04]; // "PK.." — контейнер OOXML (xlsx/docx/…)

function looksXlsx(mimeType?: string | null, fileName?: string | null): boolean {
  const mime = (mimeType ?? "").toLowerCase();
  const name = (fileName ?? "").toLowerCase();
  return (
    mime.includes("spreadsheetml") || // application/vnd.openxmlformats-officedocument.spreadsheetml.sheet
    mime === "application/vnd.ms-excel" ||
    name.endsWith(".xlsx") ||
    name.endsWith(".xlsm") ||
    name.endsWith(".xls")
  );
}

/** Реальный формат медиа по сигнатуре + (для zip) mime/имени. */
export function detectMediaKind(bytes: Uint8Array, mimeType?: string | null, fileName?: string | null): MediaKind {
  if (startsWith(bytes, JPEG) || startsWith(bytes, PNG)) return "image";
  if (startsWith(bytes, PDF)) return "pdf";
  if (startsWith(bytes, ZIP) && looksXlsx(mimeType, fileName)) return "xlsx";
  return "unknown";
}

/** Точный mime картинки по сигнатуре (для OCR-запроса). null — не картинка. */
export function imageMime(bytes: Uint8Array): "image/jpeg" | "image/png" | null {
  if (startsWith(bytes, JPEG)) return "image/jpeg";
  if (startsWith(bytes, PNG)) return "image/png";
  return null;
}

/** Допустить медиа к чтению или отклонить. */
export function guardMedia(input: MediaGuardInput): MediaGuardResult {
  const size = input.bytes.byteLength;
  if (size <= 0) return { ok: false, reason: "empty" };
  if (size > input.maxBytes) return { ok: false, reason: "too_large" };

  const kind = detectMediaKind(input.bytes, input.mimeType, input.fileName);
  if (kind === "unknown") return { ok: false, reason: "unsupported_format" };
  return { ok: true, kind };
}
