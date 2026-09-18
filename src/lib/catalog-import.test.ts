import { test } from "node:test";
import assert from "node:assert/strict";
import ExcelJS from "exceljs";
import JSZip from "jszip";
import type { Product } from "@/src/types";
import {
  parseCatalogWorkbook,
  readOoxmlCells,
  rowPatch,
  computeCatalogDiff,
  type CatalogFileRow,
} from "./catalog-import";

// Разбор загружаемого прайса. Важное здесь — не «оно как-то читает», а два пути чтения:
// ExcelJS и ручной OOXML-fallback. Fallback появился из-за реального бага «Файл пустой
// или не распознан»: файл, пересохранённый сторонним редактором, — валидный OOXML-zip,
// но ExcelJS на нём падает. Тесты держат оба пути и поведение на мусорном файле.

const HEADERS = ["id", "Название", "Цена ₸", "Мин. кол-во", "Остаток", "Состав", "Описание", "Архив"];

function product(over: Partial<Product> = {}): Product {
  return {
    id: "medovik",
    name: "Медовик",
    slug: "medovik",
    description: "",
    category_id: "cakes",
    price: 1000,
    unit: "шт",
    min_qty: 1,
    step_qty: 1,
    stock_qty: 10,
    images: [],
    is_active: true,
    sort_order: 0,
    ...over,
  };
}

/** Нормальный .xlsx — такой же, какой отдаёт «Выгрузить каталог» (путь ExcelJS). */
async function buildXlsx(rows: unknown[][]): Promise<ArrayBuffer> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Каталог");
  ws.addRow(HEADERS);
  for (const row of rows) ws.addRow(row as ExcelJS.CellValue[]);
  const buffer = await wb.xlsx.writeBuffer();
  return buffer as ArrayBuffer;
}

const colLetter = (i: number) => String.fromCharCode(65 + i);
const xmlEscape = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/**
 * «Кривой», но валидный OOXML-zip: теги с префиксом `x:`, нет docProps, все строки —
 * shared strings. Это форма файла, на которой падает ExcelJS и ради которой написан
 * ручной fallback. Строим руками, чтобы фикстура не зависела от генератора.
 */
async function buildPrefixedOoxml(rows: string[][]): Promise<ArrayBuffer> {
  const shared: string[] = [];
  const indexOfShared = (text: string) => {
    const found = shared.indexOf(text);
    if (found !== -1) return found;
    shared.push(text);
    return shared.length - 1;
  };

  const sheetRows = rows
    .map((cells, r) => {
      const xmlCells = cells
        .map((value, c) => {
          const ref = `${colLetter(c)}${r + 1}`;
          if (value === "") return "";
          // Числа кладём как есть, текст — в sharedStrings (t="s"), как делает Excel.
          if (/^-?\d+(\.\d+)?$/.test(value)) {
            return `<x:c r="${ref}"><x:v>${value}</x:v></x:c>`;
          }
          return `<x:c r="${ref}" t="s"><x:v>${indexOfShared(value)}</x:v></x:c>`;
        })
        .join("");
      return `<x:row r="${r + 1}">${xmlCells}</x:row>`;
    })
    .join("");

  const zip = new JSZip();
  zip.file(
    "[Content_Types].xml",
    '<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"/>',
  );
  zip.file(
    "xl/workbook.xml",
    '<?xml version="1.0" encoding="UTF-8"?><x:workbook xmlns:x="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
      '<x:sheets><x:sheet name="Каталог" sheetId="1" r:id="{2C7EE24B-0000-0000-0000-000000000001}"/></x:sheets>' +
      "</x:workbook>",
  );
  zip.file(
    "xl/sharedStrings.xml",
    '<?xml version="1.0" encoding="UTF-8"?><x:sst xmlns:x="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
      shared.map((s) => `<x:si><x:t>${xmlEscape(s)}</x:t></x:si>`).join("") +
      "</x:sst>",
  );
  zip.file(
    "xl/worksheets/sheet1.xml",
    '<?xml version="1.0" encoding="UTF-8"?><x:worksheet xmlns:x="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
      `<x:sheetData>${sheetRows}</x:sheetData></x:worksheet>`,
  );

  const nodeBuffer = await zip.generateAsync({ type: "nodebuffer" });
  return nodeBuffer.buffer.slice(
    nodeBuffer.byteOffset,
    nodeBuffer.byteOffset + nodeBuffer.byteLength,
  ) as ArrayBuffer;
}

test("parseCatalogWorkbook: обычный .xlsx из «Выгрузить каталог»", async () => {
  const buffer = await buildXlsx([
    ["medovik", "Медовик", 3200, 2, 15, "мёд, сметана", "Классический", ""],
    ["napoleon", "Наполеон", 4100, 1, 0, "", "", "да"],
  ]);

  const { rows, warnings } = await parseCatalogWorkbook(buffer);

  assert.equal(warnings.length, 0);
  assert.equal(rows.length, 2);
  assert.deepEqual(
    { id: rows[0].id, price: rows[0].price, min_qty: rows[0].min_qty, stock_qty: rows[0].stock_qty },
    { id: "medovik", price: 3200, min_qty: 2, stock_qty: 15 },
  );
  assert.equal(rows[0].composition, "мёд, сметана");
  assert.equal(rows[0].is_archived, false);
  assert.equal(rows[1].is_archived, true, "«да» в колонке «Архив» = архив");
});

test("parseCatalogWorkbook: строки без id пропускаются, цена с пробелами и запятой читается", async () => {
  const buffer = await buildXlsx([
    ["medovik", "Медовик", "3 200,50", 1, 5, "", "", ""],
    ["", "Строка-мусор без id", 999, 1, 1, "", "", ""],
  ]);

  const { rows } = await parseCatalogWorkbook(buffer);

  assert.equal(rows.length, 1, "строка без id не попадает в разбор");
  assert.equal(rows[0].price, 3200.5);
});

test("readOoxmlCells: sharedStrings, числа и XML-сущности", async () => {
  const buffer = await buildPrefixedOoxml([
    ["id", "Название", "Цена ₸"],
    ["medovik", "Мёд & сметана", "3200"],
  ]);

  const cells = await readOoxmlCells(buffer);

  assert.equal(cells.length, 2);
  assert.equal(cells[0].n, 1);
  assert.deepEqual(cells[0].cells, { A: "id", B: "Название", C: "Цена ₸" });
  assert.equal(cells[1].cells.B, "Мёд & сметана", "&amp; разворачивается обратно");
  assert.equal(cells[1].cells.C, "3200");
});

test("parseCatalogWorkbook: файл, который не читает ExcelJS, разбирается fallback'ом", async () => {
  // Регрессия на «Файл пустой или не распознан»: данные в файле целы, читать обязаны.
  const buffer = await buildPrefixedOoxml([
    HEADERS,
    ["medovik", "Медовик", "3200", "2", "15", "мёд, сметана", "Классический", ""],
    ["napoleon", "Наполеон", "4100", "1", "7", "", "", ""],
  ]);

  const { rows } = await parseCatalogWorkbook(buffer);

  assert.equal(rows.length, 2);
  assert.equal(rows[0].id, "medovik");
  assert.equal(rows[0].price, 3200);
  assert.equal(rows[0].stock_qty, 15);
  assert.equal(rows[0].composition, "мёд, сметана");
  assert.equal(rows[1].id, "napoleon");
  assert.equal(rows[1].price, 4100);
});

test("parseCatalogWorkbook: без колонки id — понятное предупреждение, а не пустота молча", async () => {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Каталог");
  ws.addRow(["Товар", "Стоимость"]);
  ws.addRow(["Медовик", 3200]);
  const noId = (await wb.xlsx.writeBuffer()) as ArrayBuffer;

  const { rows, warnings } = await parseCatalogWorkbook(noId);

  assert.equal(rows.length, 0);
  assert.match(warnings[0] ?? "", /id/, "предупреждение объясняет, что нет колонки id");
});

test("parseCatalogWorkbook: мусорный файл не роняет разбор", async () => {
  const garbage = new TextEncoder().encode("это вообще не таблица, а текст").buffer;

  const { rows, warnings } = await parseCatalogWorkbook(garbage as ArrayBuffer);

  assert.equal(rows.length, 0);
  assert.ok(warnings.length > 0, "пользователю объясняем, что не так с файлом");
});

// --- применение разобранной строки к товару -------------------------------------

function fileRow(over: Partial<CatalogFileRow> = {}): CatalogFileRow {
  return {
    id: "medovik",
    name: "Медовик",
    price: null,
    composition: null,
    description: null,
    stock_qty: null,
    min_qty: null,
    is_archived: null,
    ...over,
  };
}

test("rowPatch: пустая ячейка не стирает состав и описание", () => {
  const changes = rowPatch(
    fileRow({ composition: "", description: "" }),
    product({ composition: "мёд, сметана", description: "Классический" }),
  );

  assert.deepEqual(changes, [], "очистка текста — только вручную в карточке товара");
});

test("rowPatch: цена и остаток капятся, как в ручном редакторе", () => {
  const changes = rowPatch(fileRow({ price: 999999, stock_qty: 500 }), product());

  assert.equal(changes.find((c) => c.field === "price")?.to, 20000);
  assert.equal(changes.find((c) => c.field === "stock_qty")?.to, 100);
});

test("колонка «Шаг» в старом файле игнорируется и товар не меняет", async () => {
  // Продажи кратно коробкам нет (решение владельца 18.09.2026), шаг больше не
  // импортируется. Но выгрузки, сделанные ДО этой правки, содержат колонку «Шаг» —
  // такой файл обязан грузиться по-прежнему, просто без учёта этой колонки.
  const oldHeaders = ["id", "Название", "Цена ₸", "Мин. кол-во", "Шаг", "Остаток"];
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Каталог");
  ws.addRow(oldHeaders);
  ws.addRow(["medovik", "Медовик", 3200, 2, 5, 15]);
  const buffer = (await wb.xlsx.writeBuffer()) as ArrayBuffer;

  const { rows } = await parseCatalogWorkbook(buffer);

  assert.equal(rows.length, 1);
  assert.equal(rows[0].min_qty, 2, "соседняя «Мин. кол-во» читается как раньше");
  assert.equal(rows[0].stock_qty, 15, "колонка после «Шага» не съезжает");
  assert.ok(!("step_qty" in rows[0]), "шаг в разобранную строку не попадает");

  const changes = rowPatch(rows[0], product({ min_qty: 1, price: 3200, stock_qty: 15 }));
  assert.deepEqual(
    changes.map((c) => c.field),
    ["min_qty"],
    "из файла применяется только мин. кол-во, шаг не порождает изменения",
  );
});

test("computeCatalogDiff: неизвестный id в предупреждения, отсутствующий товар — в архив", () => {
  const rows = [fileRow({ id: "medovik", price: 3200 }), fileRow({ id: "unknown-id", price: 100 })];
  const products = [
    product({ id: "medovik", name: "Медовик", price: 1000 }),
    product({ id: "napoleon", name: "Наполеон", price: 4100 }),
  ];

  const diff = computeCatalogDiff(rows, products);

  assert.equal(diff.fileRowCount, 2);
  assert.equal(diff.changes.length, 1);
  assert.equal(diff.changes[0].id, "medovik");
  assert.deepEqual(diff.unknownRows, [{ rowNumber: 3, id: "unknown-id" }]);
  assert.deepEqual(diff.toArchive, [{ id: "napoleon", name: "Наполеон" }], "товара нет в файле → в архив");
  assert.match(diff.warnings[0] ?? "", /неизвестным id/);
});
