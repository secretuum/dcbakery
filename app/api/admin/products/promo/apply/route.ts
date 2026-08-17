import { NextResponse } from "next/server";
import { revalidatePath, revalidateTag } from "next/cache";
import { CATALOG_CACHE_TAG, fetchAdminProducts } from "@/src/lib/catalog";
import { parseCatalogWorkbook } from "@/src/lib/catalog-import";
import { getCatalogPromo, writeCatalogPromo } from "@/src/lib/catalog-promo.server";

// Акция каталога — сохранение промо-цен. Источник цен:
//   • file      — .xlsx как «Выгрузить каталог» (колонка price = акционная), ИЛИ
//   • pricesJson — {id: цена} из «умной загрузки» (после ИИ-предпросмотра).
// В акцию идут ТОЛЬКО цены НИЖЕ текущей базовой (промо = скидка). Базовый каталог НЕ трогаем —
// цены в app_settings['catalog_promo'] (обратимо). Полный админ (не в MANAGER_ALLOWED_MUTATIONS).

type Candidate = { id: string; price: number };

/** Разложить кандидатов по базовым ценам: что применить (ниже базы) и почему пропущено. */
function classify(candidates: Candidate[], basePrice: Map<string, number>) {
  const prices: Record<string, number> = {};
  let applied = 0, unchanged = 0, higher = 0, notFound = 0;
  for (const c of candidates) {
    const base = basePrice.get(c.id);
    if (base === undefined) { notFound++; continue; }
    if (!Number.isFinite(c.price) || c.price <= 0) { notFound++; continue; }
    if (c.price < base) { prices[c.id] = Math.round(c.price); applied++; }
    else if (c.price === base) unchanged++;
    else higher++;
  }
  return { prices, applied, unchanged, higher, notFound };
}

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

  // Собираем кандидатов из файла ИЛИ из pricesJson (умная загрузка). Нет ни того, ни
  // другого → меняем только текст/дату/вкл-выкл, прежние цены сохраняем.
  let candidates: Candidate[] | null = null;

  const pricesJson = form.get("pricesJson");
  const file = form.get("file");

  if (typeof pricesJson === "string" && pricesJson.trim()) {
    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(pricesJson) as Record<string, unknown>;
    } catch {
      return NextResponse.json({ error: "Битый список цен" }, { status: 400 });
    }
    candidates = Object.entries(parsed).map(([id, price]) => ({ id, price: Number(price) }));
  } else if (file instanceof File && file.size > 0) {
    const { rows, warnings } = await parseCatalogWorkbook(await file.arrayBuffer());
    if (rows.length === 0) {
      return NextResponse.json(
        { error: warnings[0] ?? "Файл пустой или не распознан (нужен .xlsx из «Выгрузить каталог»)" },
        { status: 400 },
      );
    }
    candidates = rows.map((r) => ({ id: r.id, price: Number(r.price) }));
  }

  let stats = { applied: 0, unchanged: 0, higher: 0, notFound: 0 };
  let prices = { ...current.prices };

  if (candidates) {
    const products = await fetchAdminProducts(); // базовые цены (без промо)
    const basePrice = new Map(products.map((p) => [p.id, p.price]));
    const result = classify(candidates, basePrice);
    prices = result.prices; // файл/список ПЕРЕ-задаёт цены целиком
    stats = { applied: result.applied, unchanged: result.unchanged, higher: result.higher, notFound: result.notFound };
  }

  const saved = await writeCatalogPromo({ enabled, label, activeUntil, prices });
  revalidateTag(CATALOG_CACHE_TAG, "max");
  revalidatePath("/", "layout");
  revalidatePath("/catalog");

  return NextResponse.json({
    ok: true,
    enabled: saved.enabled,
    count: Object.keys(saved.prices).length,
    ...stats,
  });
}
