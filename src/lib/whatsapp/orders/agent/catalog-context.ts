// Компактное представление каталога для LLM-агента: категории, товары, фасовка,
// цена, остаток. Модель отвечает на вопросы и решает, какие товары добавить (по id),
// но ЦЕНУ/ИТОГ считает сервер — здесь лишь справочник. Чистая функция (без сети/БД).

import type { Product } from "@/src/types";

/** Текстовый справочник каталога для системного контекста модели. */
export function buildCatalogContext(products: Product[]): string {
  const byCategory = new Map<string, Product[]>();
  for (const p of products) {
    const cat = p.category?.name ?? p.subcategory ?? "Прочее";
    const bucket = byCategory.get(cat);
    if (bucket) bucket.push(p);
    else byCategory.set(cat, [p]);
  }

  const lines: string[] = [];
  for (const [cat, items] of byCategory) {
    lines.push(`### ${cat}`);
    for (const p of items) {
      const pack = [p.weightLabel, p.packageType].filter(Boolean).join(", ");
      const stock =
        Number(p.stock_qty) > 0 ? `в наличии ${Math.floor(Number(p.stock_qty))}` : "нет в наличии";
      const price = Number(p.price) > 0 ? `${Math.round(Number(p.price))} ₸/ед.` : "цена уточняется";
      lines.push(`- id=${p.id} | ${p.name}${pack ? ` [${pack}]` : ""} | ${price} | ${stock}`);
    }
  }
  return lines.join("\n");
}

/** Множество валидных id товаров — для проверки действий модели (защита от выдумок). */
export function catalogProductIds(products: Product[]): Set<string> {
  return new Set(products.map((p) => p.id));
}
