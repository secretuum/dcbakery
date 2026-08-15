import "server-only";
import ExcelJS from "exceljs";
import JSZip from "jszip";
import type { Product } from "@/src/types";

// Разбор выгруженного каталога (.xlsx из buildCatalogWorkbook) и вычисление diff'а
// против текущих товаров. НИЧЕГО не пишет — только считает, что изменится. Применение
// (по подтверждению) — через upsertCatalogProductOverride в API-роуте.
// Импортируемые поля: цена, состав, описание, остаток, мин.кол-во, шаг, архив.
// Матчинг строго по id. slug/название/категорию по файлу НЕ меняем.

export type CatalogFileRow = {
  id: string;
  name: string;
  price: number | null;
  composition: string | null;
  description: string | null;
  stock_qty: number | null;
  min_qty: number | null;
  step_qty: number | null;
  is_archived: boolean | null;
};

export type FieldChange = { field: string; label: string; from: unknown; to: unknown };
export type ProductChange = { id: string; name: string; changes: FieldChange[] };

export type CatalogDiff = {
  changes: ProductChange[];
  toArchive: { id: string; name: string }[];
  unknownRows: { rowNumber: number; id: string }[];
  warnings: string[];
  fileRowCount: number;
};

function cellText(value: ExcelJS.CellValue): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "object") {
    const v = value as unknown as Record<string, unknown>;
    if (typeof v.text === "string") return v.text.trim();
    if (Array.isArray(v.richText)) {
      return v.richText.map((run) => (run as { text?: string }).text ?? "").join("").trim();
    }
    if (v.result !== undefined) return String(v.result).trim();
  }
  return String(value).trim();
}

function toNumberOrNull(text: string): number | null {
  if (!text) return null;
  const n = Number(text.replace(/\s/g, "").replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

function toBoolOrNull(text: string): boolean | null {
  const t = text.trim().toLowerCase();
  if (!t) return false; // пусто = не архив
  return t === "да" || t === "true" || t === "1" || t === "yes";
}

/** Находит колонку по ключевому слову в заголовке (регистронезависимо). */
function buildHeaderIndex(headerRow: ExcelJS.Row): Record<string, number> {
  const idx: Record<string, number> = {};
  const match: [string, RegExp][] = [
    ["id", /\bid\b/],
    ["name", /назван/],
    ["price", /цена/],
    ["composition", /состав/],
    ["description", /описан/],
    ["stock", /остаток/],
    ["min", /мин/],
    ["step", /шаг/],
    ["archived", /архив/],
  ];
  headerRow.eachCell((cell, col) => {
    const header = cellText(cell.value).toLowerCase();
    for (const [key, re] of match) {
      if (idx[key] === undefined && re.test(header)) idx[key] = col;
    }
  });
  return idx;
}

/** Собрать CatalogFileRow из «сырых» строк, где ячейки — уже строки по ключу поля. */
function rowsFromValues(records: Array<Record<string, string>>): CatalogFileRow[] {
  return records.map((r) => ({
    id: r.id ?? "",
    name: r.name ?? "",
    price: r.price === undefined ? null : toNumberOrNull(r.price),
    composition: r.composition === undefined ? null : r.composition,
    description: r.description === undefined ? null : r.description,
    stock_qty: r.stock === undefined ? null : toNumberOrNull(r.stock),
    min_qty: r.min === undefined ? null : toNumberOrNull(r.min),
    step_qty: r.step === undefined ? null : toNumberOrNull(r.step),
    is_archived: r.archived === undefined ? null : toBoolOrNull(r.archived),
  }));
}

/** Основной путь: ExcelJS (умеет формулы/стили/inline). Кидает — значит формат не тот. */
async function parseWithExcelJs(
  buffer: ArrayBuffer,
): Promise<{ rows: CatalogFileRow[]; warnings: string[] }> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer); // бросает при нечитаемом файле — ловит вызывающий
  const ws = wb.getWorksheet("Каталог") ?? wb.worksheets[0];
  if (!ws) return { rows: [], warnings: ["В файле нет ни одного листа."] };

  const idx = buildHeaderIndex(ws.getRow(1));
  if (idx.id === undefined) {
    return { rows: [], warnings: ["Не найдена колонка «id» — это выгрузка не из «Выгрузить каталог»?"] };
  }

  const col = (r: ExcelJS.Row, key: string): string =>
    idx[key] === undefined ? "" : cellText(r.getCell(idx[key]).value);

  const records: Array<Record<string, string>> = [];
  ws.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    const id = col(row, "id");
    if (!id) return;
    const rec: Record<string, string> = {};
    for (const key of Object.keys(idx)) rec[key] = col(row, key);
    records.push(rec);
  });
  return { rows: rowsFromValues(records), warnings: [] };
}

const XML_ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" };
function unescapeXml(s: string): string {
  return s.replace(/&(#x?[0-9a-fA-F]+|amp|lt|gt|quot|apos);/g, (_, e: string) => {
    if (e[0] === "#") return String.fromCodePoint(parseInt(e[1] === "x" ? e.slice(2) : e.slice(1), e[1] === "x" ? 16 : 10));
    return XML_ENTITIES[e] ?? _;
  });
}

/**
 * Разбор OOXML-таблицы вручную через jszip (sharedStrings + первый лист) → ячейки по
 * буквам колонок для каждой строки. Нужен как fallback: некоторые редакторы/генераторы
 * сохраняют .xlsx, который ExcelJS НЕ читает (x:-префиксы, нет docProps, GUID-rel'ы),
 * хотя файл — валидный OOXML-zip. Регэксп-парс оправдан: well-formed OOXML, не общий XML.
 * Экспортируется для «умной загрузки» (там нужен весь грид без привязки к колонке id).
 */
export async function readOoxmlCells(
  buffer: ArrayBuffer,
): Promise<Array<{ n: number; cells: Record<string, string> }>> {
  const zip = await JSZip.loadAsync(buffer);
  const T = /<(?:\w+:)?t\b[^>]*>([\s\S]*?)<\/(?:\w+:)?t>/g;

  // sharedStrings: <si> → конкатенация всех <t>. Может отсутствовать.
  const ssXml = (await zip.file("xl/sharedStrings.xml")?.async("string")) ?? "";
  const shared: string[] = [];
  for (const si of ssXml.match(/<(?:\w+:)?si\b[\s\S]*?<\/(?:\w+:)?si>/g) ?? []) {
    const parts = [...si.matchAll(T)].map((m) => unescapeXml(m[1]));
    shared.push(parts.join(""));
  }

  // Первый лист по имени файла (sheet1.xml…), иначе любой worksheets/*.xml.
  const sheetName =
    Object.keys(zip.files)
      .filter((n) => /^xl\/worksheets\/sheet\d+\.xml$/i.test(n))
      .sort()[0] ??
    Object.keys(zip.files).find((n) => /^xl\/worksheets\/.+\.xml$/i.test(n));
  if (!sheetName) return [];
  const sheetXml = (await zip.file(sheetName)!.async("string")) ?? "";

  const colOf = (ref: string) => ref.replace(/\d+/g, "");
  const cellValue = (attrs: string, inner: string): string => {
    const v = (inner.match(/<(?:\w+:)?v\b[^>]*>([\s\S]*?)<\/(?:\w+:)?v>/) ?? [])[1];
    if (/\bt="s"/.test(attrs)) return shared[Number(v)] ?? ""; // shared string по индексу
    const inl = (inner.match(T) ?? [])[0]?.replace(/<[^>]+>/g, ""); // inlineStr
    return unescapeXml(v ?? inl ?? "");
  };

  const parsed: Array<{ n: number; cells: Record<string, string> }> = [];
  for (const rm of sheetXml.matchAll(/<(?:\w+:)?row\b[^>]*?\br="(\d+)"[^>]*>([\s\S]*?)<\/(?:\w+:)?row>/g)) {
    const cells: Record<string, string> = {};
    for (const cm of rm[2].matchAll(/<(?:\w+:)?c\b[^>]*?\br="([A-Z]+\d+)"([^>]*)>([\s\S]*?)<\/(?:\w+:)?c>/g)) {
      cells[colOf(cm[1])] = cellValue(cm[2], cm[3]);
    }
    parsed.push({ n: Number(rm[1]), cells });
  }
  return parsed;
}

/**
 * Fallback-разбор каталога: читает OOXML вручную (readOoxmlCells) и мапит колонки по
 * заголовку — для файлов, которые не читает ExcelJS.
 */
async function parseManualOoxml(
  buffer: ArrayBuffer,
): Promise<{ rows: CatalogFileRow[]; warnings: string[] }> {
  const parsed = await readOoxmlCells(buffer);
  if (parsed.length === 0) return { rows: [], warnings: ["В файле нет листа с данными."] };

  const header = parsed.find((r) => r.n === 1)?.cells ?? {};
  const HEADER_MATCH: [string, RegExp][] = [
    ["id", /\bid\b/], ["name", /назван/], ["price", /цена/], ["composition", /состав/],
    ["description", /описан/], ["stock", /остаток/], ["min", /мин/], ["step", /шаг/], ["archived", /архив/],
  ];
  const keyToCol: Record<string, string> = {};
  for (const [colLetter, text] of Object.entries(header)) {
    const h = text.toLowerCase();
    for (const [key, re] of HEADER_MATCH) if (keyToCol[key] === undefined && re.test(h)) keyToCol[key] = colLetter;
  }
  if (keyToCol.id === undefined) {
    return { rows: [], warnings: ["Не найдена колонка «id» — это выгрузка не из «Выгрузить каталог»?"] };
  }

  const records: Array<Record<string, string>> = [];
  for (const { n, cells } of parsed) {
    if (n === 1) continue;
    const id = (cells[keyToCol.id] ?? "").trim();
    if (!id) continue;
    const rec: Record<string, string> = {};
    for (const [key, colLetter] of Object.entries(keyToCol)) rec[key] = (cells[colLetter] ?? "").trim();
    records.push(rec);
  }
  return { rows: rowsFromValues(records), warnings: [] };
}

export async function parseCatalogWorkbook(
  buffer: ArrayBuffer,
): Promise<{ rows: CatalogFileRow[]; warnings: string[] }> {
  // 1) ExcelJS. 2) если бросил или не нашёл строк — ручной OOXML-fallback (файлы из
  // сторонних редакторов, которые ExcelJS не читает: x:-префиксы, нет docProps).
  let excelResult: { rows: CatalogFileRow[]; warnings: string[] } | null = null;
  try {
    excelResult = await parseWithExcelJs(buffer);
    if (excelResult.rows.length > 0) return excelResult;
  } catch {
    // формат не по зубам ExcelJS — идём в fallback
  }

  try {
    const manual = await parseManualOoxml(buffer);
    if (manual.rows.length > 0) return manual;
    // оба пусто — вернём более информативное предупреждение
    return excelResult ?? manual;
  } catch {
    return (
      excelResult ?? {
        rows: [],
        warnings: ["Не удалось прочитать файл. Нужен .xlsx из «Выгрузить каталог»."],
      }
    );
  }
}

const norm = (v: unknown) => String(v ?? "").trim();

/** Патч изменённых полей для одного товара (только то, что реально отличается). */
export function rowPatch(row: CatalogFileRow, product: Product): FieldChange[] {
  const changes: FieldChange[] = [];
  const push = (field: string, label: string, from: unknown, to: unknown) => {
    changes.push({ field, label, from, to });
  };

  // Цена: капим до 20000 (как ручной редактор) — импорт не должен обходить лимит.
  if (row.price !== null && row.price >= 0) {
    const price = Math.round(Math.min(row.price, 20000));
    if (price !== Math.round(product.price)) push("price", "Цена", product.price, price);
  }
  // Текст: ПУСТУЮ ячейку НЕ применяем (иначе можно случайно стереть состав/описание).
  // Очистить состав/описание — только вручную в карточке товара.
  if (row.composition !== null && norm(row.composition) !== "" && norm(row.composition) !== norm(product.composition)) {
    push("composition", "Состав", product.composition ?? "", row.composition);
  }
  if (row.description !== null && norm(row.description) !== "" && norm(row.description) !== norm(product.description)) {
    push("description", "Описание", product.description ?? "", row.description);
  }
  // Остаток: капим до 100 (как ручной редактор).
  if (row.stock_qty !== null && row.stock_qty >= 0) {
    const stock = Math.round(Math.min(row.stock_qty, 100));
    if (stock !== Math.round(product.stock_qty)) push("stock_qty", "Остаток", product.stock_qty, stock);
  }
  if (row.min_qty !== null && row.min_qty >= 1 && Math.round(row.min_qty) !== Math.round(product.min_qty)) {
    push("min_qty", "Мин. кол-во", product.min_qty, Math.round(row.min_qty));
  }
  if (row.is_archived !== null && row.is_archived !== Boolean(product.isArchived)) {
    push("is_archived", "Архив", Boolean(product.isArchived), row.is_archived);
  }
  return changes;
}

export function computeCatalogDiff(rows: CatalogFileRow[], products: Product[]): CatalogDiff {
  const byId = new Map(products.map((p) => [p.id, p]));
  const fileIds = new Set<string>();
  const changes: ProductChange[] = [];
  const unknownRows: { rowNumber: number; id: string }[] = [];
  const warnings: string[] = [];

  rows.forEach((row, i) => {
    const product = byId.get(row.id);
    if (!product) {
      unknownRows.push({ rowNumber: i + 2, id: row.id });
      return;
    }
    fileIds.add(row.id);
    const fieldChanges = rowPatch(row, product);
    if (fieldChanges.length > 0) {
      changes.push({ id: row.id, name: product.name, changes: fieldChanges });
    }
  });

  // Товары, которых нет в файле → предложить в архив (НЕ удаляем).
  const toArchive = products
    .filter((p) => !fileIds.has(p.id) && !p.isArchived)
    .map((p) => ({ id: p.id, name: p.name }));

  if (unknownRows.length > 0) {
    warnings.push(`${unknownRows.length} строк(и) с неизвестным id пропущены (id/slug менять нельзя).`);
  }

  return { changes, toArchive, unknownRows, warnings, fileRowCount: rows.length };
}
