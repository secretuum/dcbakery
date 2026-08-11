import "server-only";
import ExcelJS from "exceljs";
import type { Product } from "@/src/types";

// Выгрузка каталога в .xlsx для ручной правки менеджером (цены, состав, остатки…) и
// последующей загрузки обратно. Колонка id — ключ для сопоставления при импорте:
// её МЕНЯТЬ НЕЛЬЗЯ (иначе строка не свяжется с товаром).

type CatalogColumn = { header: string; key: keyof CatalogRow; width: number };

type CatalogRow = {
  id: string;
  name: string;
  category: string;
  price: number;
  unit: string;
  min_qty: number;
  step_qty: number;
  stock_qty: number;
  composition: string;
  description: string;
  weight: string;
  slug: string;
  isPopular: string;
  isArchived: string;
};

const COLUMNS: CatalogColumn[] = [
  { header: "id (НЕ менять)", key: "id", width: 38 },
  { header: "Название", key: "name", width: 40 },
  { header: "Категория", key: "category", width: 22 },
  { header: "Цена ₸", key: "price", width: 12 },
  { header: "Ед.", key: "unit", width: 8 },
  { header: "Мин. кол-во", key: "min_qty", width: 12 },
  { header: "Шаг", key: "step_qty", width: 8 },
  { header: "Остаток", key: "stock_qty", width: 10 },
  { header: "Состав", key: "composition", width: 50 },
  { header: "Описание", key: "description", width: 50 },
  { header: "Вес", key: "weight", width: 14 },
  { header: "Slug (НЕ менять)", key: "slug", width: 28 },
  { header: "Популярный (да/пусто)", key: "isPopular", width: 14 },
  { header: "Архив (да/пусто)", key: "isArchived", width: 12 },
];

export async function buildCatalogWorkbook(products: Product[]): Promise<ExcelJS.Buffer> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Каталог", { views: [{ state: "frozen", ySplit: 1 }] });

  ws.columns = COLUMNS.map((column) => ({ header: column.header, key: column.key, width: column.width }));

  const headerRow = ws.getRow(1);
  headerRow.font = { bold: true };
  headerRow.alignment = { vertical: "middle", wrapText: true };
  ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: COLUMNS.length } };

  for (const product of products) {
    ws.addRow({
      id: product.id,
      name: product.name,
      category: product.category?.name ?? "",
      price: product.price,
      unit: product.unit ?? "шт",
      min_qty: product.min_qty,
      step_qty: product.step_qty,
      stock_qty: product.stock_qty,
      composition: product.composition ?? "",
      description: product.description ?? "",
      weight: product.weightLabel ?? product.weight ?? "",
      slug: product.slug,
      isPopular: product.isPopular ? "да" : "",
      isArchived: product.isArchived ? "да" : "",
    } satisfies CatalogRow);
  }

  // Числовой формат для цены (колонка 4).
  ws.getColumn(4).numFmt = "#,##0";

  return wb.xlsx.writeBuffer();
}
