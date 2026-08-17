import "server-only";
// Чтение фото/документа в текст. Маршрутизация по РЕАЛЬНОМУ формату (media-guard):
//  - image / pdf → Yandex Vision OCR;
//  - xlsx        → exceljs (структурированные ячейки → текст).
// Интерфейс MediaReader отделяет логику от провайдера (в тестах — фейк). Выход — текст
// как НЕДОВЕРЕННЫЕ данные, дальше идёт в обычный поток агента (как расшифровка голоса).

import ExcelJS from "exceljs";
import { detectMediaKind, imageMime } from "./media-guard";
import { recognizeText } from "./yandex-ocr";

export type MediaReadInput = {
  bytes: Uint8Array;
  mimeType?: string | null;
  fileName?: string | null;
};

export interface MediaReader {
  read(input: MediaReadInput): Promise<{ text: string }>;
}

/** Предел длины извлечённого текста — анти-раздувание промпта/токенов. */
const MAX_EXTRACTED_LENGTH = 8000;

function cellToString(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === "object") {
    const o = value as Record<string, unknown>;
    if (typeof o.text === "string") return o.text; // hyperlink / rich text
    if (Array.isArray(o.richText)) {
      return (o.richText as Array<{ text?: string }>).map((r) => r.text ?? "").join("");
    }
    if ("result" in o) return String(o.result ?? ""); // формула → результат
  }
  return "";
}

/** Excel → плоский текст (по листам и строкам), чтобы агент разобрал заказ. */
async function readXlsx(bytes: Uint8Array): Promise<string> {
  const wb = new ExcelJS.Workbook();
  // exceljs.load принимает ArrayBuffer (как в catalog-import); отдаём ровно наш срез.
  const ab = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
  await wb.xlsx.load(ab);
  const lines: string[] = [];
  wb.eachSheet((sheet) => {
    if (sheet.name) lines.push(`# ${sheet.name}`);
    sheet.eachRow((row) => {
      const values = Array.isArray(row.values) ? row.values.slice(1) : [];
      const cells = values.map((v) => cellToString(v).trim()).filter(Boolean);
      if (cells.length) lines.push(cells.join(" | "));
    });
  });
  return lines.join("\n").trim();
}

export class DefaultMediaReader implements MediaReader {
  async read(input: MediaReadInput): Promise<{ text: string }> {
    const kind = detectMediaKind(input.bytes, input.mimeType, input.fileName);
    let text = "";

    if (kind === "image") {
      const mime = imageMime(input.bytes);
      if (mime) text = await recognizeText({ bytes: input.bytes, mimeType: mime });
    } else if (kind === "pdf") {
      text = await recognizeText({ bytes: input.bytes, mimeType: "application/pdf" });
    } else if (kind === "xlsx") {
      text = await readXlsx(input.bytes);
    }

    return { text: text.slice(0, MAX_EXTRACTED_LENGTH).trim() };
  }
}
