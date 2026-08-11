import "server-only";
import ExcelJS from "exceljs";
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

export async function parseCatalogWorkbook(
  buffer: ArrayBuffer,
): Promise<{ rows: CatalogFileRow[]; warnings: string[] }> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer);
  const ws = wb.getWorksheet("Каталог") ?? wb.worksheets[0];
  const warnings: string[] = [];
  if (!ws) {
    return { rows: [], warnings: ["В файле нет ни одного листа."] };
  }

  const idx = buildHeaderIndex(ws.getRow(1));
  if (idx.id === undefined) {
    return { rows: [], warnings: ["Не найдена колонка «id» — это выгрузка не из «Выгрузить каталог»?"] };
  }

  const rows: CatalogFileRow[] = [];
  const col = (r: ExcelJS.Row, key: string): string =>
    idx[key] === undefined ? "" : cellText(r.getCell(idx[key]).value);

  ws.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return; // заголовок
    const id = col(row, "id");
    if (!id) return; // пустая строка
    rows.push({
      id,
      name: col(row, "name"),
      price: idx.price === undefined ? null : toNumberOrNull(col(row, "price")),
      composition: idx.composition === undefined ? null : col(row, "composition"),
      description: idx.description === undefined ? null : col(row, "description"),
      stock_qty: idx.stock === undefined ? null : toNumberOrNull(col(row, "stock")),
      min_qty: idx.min === undefined ? null : toNumberOrNull(col(row, "min")),
      step_qty: idx.step === undefined ? null : toNumberOrNull(col(row, "step")),
      is_archived: idx.archived === undefined ? null : toBoolOrNull(col(row, "archived")),
    });
  });

  return { rows, warnings };
}

const norm = (v: unknown) => String(v ?? "").trim();

/** Патч изменённых полей для одного товара (только то, что реально отличается). */
export function rowPatch(row: CatalogFileRow, product: Product): FieldChange[] {
  const changes: FieldChange[] = [];
  const push = (field: string, label: string, from: unknown, to: unknown) => {
    changes.push({ field, label, from, to });
  };

  if (row.price !== null && row.price >= 0 && Math.round(row.price) !== Math.round(product.price)) {
    push("price", "Цена", product.price, Math.round(row.price));
  }
  if (row.composition !== null && norm(row.composition) !== norm(product.composition)) {
    push("composition", "Состав", product.composition ?? "", row.composition);
  }
  if (row.description !== null && norm(row.description) !== norm(product.description)) {
    push("description", "Описание", product.description ?? "", row.description);
  }
  if (row.stock_qty !== null && row.stock_qty >= 0 && Math.round(row.stock_qty) !== Math.round(product.stock_qty)) {
    push("stock_qty", "Остаток", product.stock_qty, Math.round(row.stock_qty));
  }
  if (row.min_qty !== null && row.min_qty >= 1 && Math.round(row.min_qty) !== Math.round(product.min_qty)) {
    push("min_qty", "Мин. кол-во", product.min_qty, Math.round(row.min_qty));
  }
  if (row.step_qty !== null && row.step_qty >= 1 && Math.round(row.step_qty) !== Math.round(product.step_qty)) {
    push("step_qty", "Шаг", product.step_qty, Math.round(row.step_qty));
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
