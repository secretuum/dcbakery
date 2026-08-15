import { NextResponse } from "next/server";
import { fetchAdminProducts } from "@/src/lib/catalog";
import { extractFileTable, smartMatchPrices, isOpenAiConfigured } from "@/src/lib/catalog-smart-import";
import { discountPercent } from "@/src/lib/catalog-promo";

// «Умная загрузка», ШАГ 1 — АНАЛИЗ (ничего не сохраняет). Принимает ЛЮБОЙ файл (xlsx/csv/
// текст, произвольные колонки), ИИ сопоставляет позиции с каталогом по названию. Возвращает
// предпросмотр: что с чем сматчилось (старая→новая цена, скидка) и что не распознано.
// Мутаций нет, но роут админский (промо не в MANAGER_ALLOWED_MUTATIONS → только полный админ).
export async function POST(request: Request) {
  if (!isOpenAiConfigured()) {
    return NextResponse.json(
      { error: "Умная загрузка требует OPENAI_API_KEY (не настроен на сервере)." },
      { status: 503 },
    );
  }

  const form = await request.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json({ error: "Файл не получен" }, { status: 400 });
  }

  const { text, warning } = await extractFileTable(await file.arrayBuffer(), file.name);
  if (!text) {
    return NextResponse.json({ error: warning ?? "Не удалось прочитать файл" }, { status: 400 });
  }

  const products = await fetchAdminProducts(); // базовые цены (без промо)
  const byId = new Map(products.map((p) => [p.id, p]));

  let matched: Awaited<ReturnType<typeof smartMatchPrices>>;
  try {
    matched = await smartMatchPrices({
      fileText: text,
      catalog: products.map((p) => ({ id: p.id, name: p.name })),
    });
  } catch (error) {
    console.error("[promo:smart-preview] AI match failed:", error);
    return NextResponse.json({ error: "ИИ-анализ не удался, попробуйте ещё раз." }, { status: 502 });
  }

  const items = matched.matches.map((m) => {
    const product = byId.get(m.id)!;
    const belowBase = m.price < product.price;
    return {
      id: m.id,
      name: product.name,
      matchedName: m.matchedName,
      oldPrice: product.price,
      price: m.price,
      discount: belowBase ? discountPercent(product.price, m.price) : 0,
      belowBase,
    };
  });

  return NextResponse.json({
    ok: true,
    items,
    unmatched: matched.unmatched,
    discountCount: items.filter((i) => i.belowBase).length,
  });
}
