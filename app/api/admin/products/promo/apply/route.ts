import { NextResponse } from "next/server";
import { revalidatePath, revalidateTag } from "next/cache";
import { CATALOG_CACHE_TAG, fetchAdminProducts } from "@/src/lib/catalog";
import { parseCatalogWorkbook } from "@/src/lib/catalog-import";
import { getCatalogPromo, writeCatalogPromo } from "@/src/lib/catalog-promo.server";

// Акция каталога — загрузка/настройка промо-цен. Формат файла ТОТ ЖЕ, что у обычного
// импорта (колонки id + price из «Выгрузить каталог»), но колонка price здесь = АКЦИОННАЯ
// цена. Базовый каталог НЕ трогаем — цены живут в app_settings['catalog_promo'] (обратимо).
// Мутация → только полный админ (proxy: промо-роут не в MANAGER_ALLOWED_MUTATIONS).
export async function POST(request: Request) {
  const form = await request.formData().catch(() => null);
  if (!form) {
    return NextResponse.json({ error: "Неверный запрос" }, { status: 400 });
  }

  const action = String(form.get("action") ?? "apply");

  // Полное выключение акции: цены сбрасываются, витрина возвращается к базовым.
  if (action === "clear") {
    await writeCatalogPromo({ enabled: false, label: "", activeUntil: null, prices: {} });
    revalidateTag(CATALOG_CACHE_TAG, "max");
    revalidatePath("/", "layout");
    revalidatePath("/catalog");
    return NextResponse.json({ ok: true, cleared: true });
  }

  const current = await getCatalogPromo();
  const enabled = form.get("enabled") === "1";
  const label = String(form.get("label") ?? current.label ?? "");
  const activeUntilRaw = String(form.get("activeUntil") ?? "").trim();
  const activeUntil = /^\d{4}-\d{2}-\d{2}$/.test(activeUntilRaw) ? activeUntilRaw : null;

  // По умолчанию сохраняем прежние цены; файл (если пришёл) — пере-задаёт их целиком.
  let prices = { ...current.prices };
  let uploaded = 0;
  let skipped = 0;

  const file = form.get("file");
  if (file instanceof File && file.size > 0) {
    const { rows } = await parseCatalogWorkbook(await file.arrayBuffer());
    if (rows.length === 0) {
      return NextResponse.json({ error: "Файл пустой или не распознан (нужен .xlsx из «Выгрузить каталог»)" }, { status: 400 });
    }
    // Берём БАЗОВЫЕ цены (без промо) — чтобы хранить только реальные скидки ниже базовой.
    const products = await fetchAdminProducts();
    const basePrice = new Map(products.map((product) => [product.id, product.price]));
    prices = {};
    for (const row of rows) {
      const base = basePrice.get(row.id);
      if (base !== undefined && typeof row.price === "number" && row.price > 0 && row.price < base) {
        prices[row.id] = Math.round(row.price);
        uploaded++;
      } else {
        skipped++; // нет такого id, или цена не ниже базовой, или пустая
      }
    }
  }

  const saved = await writeCatalogPromo({ enabled, label, activeUntil, prices });
  revalidateTag(CATALOG_CACHE_TAG, "max");
  revalidatePath("/", "layout");
  revalidatePath("/catalog");

  return NextResponse.json({
    ok: true,
    enabled: saved.enabled,
    count: Object.keys(saved.prices).length,
    uploaded,
    skipped,
  });
}
