import { NextResponse } from "next/server";
import { revalidatePath, revalidateTag } from "next/cache";
import { CATALOG_CACHE_TAG, fetchAdminProducts } from "@/src/lib/catalog";
import { parseCatalogWorkbook, computeCatalogDiff } from "@/src/lib/catalog-import";
import { upsertCatalogProductOverride } from "@/src/lib/supabase/admin";

// Загрузка каталога, ШАГ 2 — ПРИМЕНЯЕТ изменения (по подтверждению). Пере-парсит файл и
// пере-считает diff (авторитетно, не доверяем клиенту), затем пишет через существующий
// upsertCatalogProductOverride (admin.ts НЕ меняется). Мутация → только полный админ (proxy).
// Отсутствующие в файле товары архивируются ТОЛЬКО при archiveMissing=1 (не удаляем).
export async function POST(request: Request) {
  const form = await request.formData().catch(() => null);
  const file = form?.get("file");
  const archiveMissing = form?.get("archiveMissing") === "1";
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Файл не получен" }, { status: 400 });
  }

  const buffer = await file.arrayBuffer();
  const { rows } = await parseCatalogWorkbook(buffer);
  if (rows.length === 0) {
    return NextResponse.json({ error: "Файл пустой или не распознан" }, { status: 400 });
  }

  const products = await fetchAdminProducts();
  const diff = computeCatalogDiff(rows, products);

  let updated = 0;
  let archived = 0;
  const failed: string[] = [];

  for (const change of diff.changes) {
    const patch: Record<string, unknown> = {};
    for (const field of change.changes) patch[field.field] = field.to;
    // Согласованность архива с активностью, как в ручном редакторе.
    if (patch.is_archived === true) patch.is_active = false;
    if (patch.is_archived === false) patch.is_active = true;
    try {
      await upsertCatalogProductOverride(change.id, patch);
      updated++;
    } catch {
      failed.push(change.name);
    }
  }

  if (archiveMissing) {
    for (const product of diff.toArchive) {
      try {
        await upsertCatalogProductOverride(product.id, { is_active: false, is_archived: true });
        archived++;
      } catch {
        failed.push(product.name);
      }
    }
  }

  revalidateTag(CATALOG_CACHE_TAG, "max");
  revalidatePath("/", "layout");
  revalidatePath("/admin/products");

  return NextResponse.json({ ok: true, updated, archived, failed });
}
