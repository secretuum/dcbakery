import { test } from "node:test";
import assert from "node:assert/strict";
import JSZip from "jszip";
import { extractFileTable } from "./catalog-smart-import";

// «Умная загрузка» промо-цен принимает ЛЮБОЙ прайс. Здесь проверяется только шаг
// извлечения текста — он детерминирован и работает без сети. Сопоставление с каталогом
// делает ИИ (smartMatchPrices), его тестировать без запроса к провайдеру нечем.

/** Минимальный валидный OOXML-zip с inline-строками (без sharedStrings). */
async function buildXlsxBuffer(rows: string[][]): Promise<ArrayBuffer> {
  const colLetter = (i: number) => String.fromCharCode(65 + i);
  const sheetRows = rows
    .map((cells, r) => {
      const xmlCells = cells
        .map((value, c) =>
          `<c r="${colLetter(c)}${r + 1}" t="inlineStr"><is><t>${value}</t></is></c>`,
        )
        .join("");
      return `<row r="${r + 1}">${xmlCells}</row>`;
    })
    .join("");

  const zip = new JSZip();
  zip.file(
    "xl/worksheets/sheet1.xml",
    '<?xml version="1.0" encoding="UTF-8"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
      `<sheetData>${sheetRows}</sheetData></worksheet>`,
  );
  const buffer = await zip.generateAsync({ type: "nodebuffer" });
  return buffer.buffer.slice(
    buffer.byteOffset,
    buffer.byteOffset + buffer.byteLength,
  ) as ArrayBuffer;
}

const encode = (text: string) => new TextEncoder().encode(text).buffer as ArrayBuffer;

test("extractFileTable: xlsx превращается в таблицу с табами по строкам", async () => {
  const buffer = await buildXlsxBuffer([
    ["Наименование", "Цена"],
    ["Медовик 1кг", "3200"],
    ["Наполеон", "4100"],
  ]);

  const { text, warning } = await extractFileTable(buffer, "прайс.xlsx");

  assert.equal(warning, undefined);
  assert.equal(text, "Наименование\tЦена\nМедовик 1кг\t3200\nНаполеон\t4100");
});

test("extractFileTable: csv и обычный текст проходят как есть", async () => {
  const csv = "Наименование;Цена\nМедовик;3200";

  const fromCsv = await extractFileTable(encode(csv), "прайс.csv");
  assert.equal(fromCsv.text, csv);
  assert.equal(fromCsv.warning, undefined);

  const fromTxt = await extractFileTable(encode("Медовик — 3200 тг"), "прайс.txt");
  assert.equal(fromTxt.text, "Медовик — 3200 тг");
});

test("extractFileTable: бинарный файл — понятное объяснение, а не молчание", async () => {
  // PDF/картинка: управляющие байты в начале. Пользователю нужно сказать, что прислать.
  const binary = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x01, 0x02, 0x03, 0x04, 0x05]);

  const { text, warning } = await extractFileTable(binary.buffer as ArrayBuffer, "прайс.pdf");

  assert.equal(text, "");
  assert.match(warning ?? "", /csv|текст/i);
});

test("extractFileTable: zip-файл без листа с данными объясняет причину", async () => {
  const zip = new JSZip();
  zip.file("readme.txt", "не таблица");
  const buffer = await zip.generateAsync({ type: "nodebuffer" });

  const { text, warning } = await extractFileTable(
    buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength) as ArrayBuffer,
    "прайс.xlsx",
  );

  assert.equal(text, "");
  assert.match(warning ?? "", /xlsx/i);
});

test("extractFileTable: xlsx распознаётся по сигнатуре даже без расширения", async () => {
  const buffer = await buildXlsxBuffer([["Медовик", "3200"]]);

  const { text } = await extractFileTable(buffer, "файл-без-расширения");

  assert.equal(text, "Медовик\t3200", "сигнатура PK важнее имени файла");
});
