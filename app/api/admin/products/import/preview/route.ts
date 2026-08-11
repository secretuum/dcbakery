import { NextResponse } from "next/server";
import { fetchAdminProducts } from "@/src/lib/catalog";
import { parseCatalogWorkbook, computeCatalogDiff } from "@/src/lib/catalog-import";

// Загрузка каталога, ШАГ 1 — только считает diff, НИЧЕГО не пишет. Возвращает, что
// изменится, чтобы админ подтвердил. Мутация (POST) → proxy пускает только полного админа.
export async function POST(request: Request) {
  const form = await request.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Файл не получен" }, { status: 400 });
  }

  const buffer = await file.arrayBuffer();
  const { rows, warnings } = await parseCatalogWorkbook(buffer);
  if (rows.length === 0) {
    return NextResponse.json({ error: warnings[0] ?? "Файл пустой или не распознан" }, { status: 400 });
  }

  const products = await fetchAdminProducts();
  const diff = computeCatalogDiff(rows, products);
  diff.warnings.push(...warnings);

  return NextResponse.json({ diff });
}
