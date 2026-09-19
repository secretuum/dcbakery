/**
 * Дата последнего изменения раздела каталога = максимум updated_at его товаров.
 *
 * У самих разделов updated_at не бывает: categoryDetails в src/lib/catalog.ts —
 * это Pick<> без этого поля, разделы захардкожены в коде. Поэтому единственный
 * честный сигнал свежести раздела — когда менеджер последний раз правил товар в нём.
 *
 * Вынесено из app/sitemap.ts отдельным модулем, чтобы логику можно было покрыть
 * тестами: сам sitemap.ts тянет supabase и next/cache и в тест-раннере не грузится.
 */
export function categoryLastModified(
  products: readonly { category_id: string; updated_at?: string }[],
): Map<string, string> {
  const newest = new Map<string, string>();

  for (const product of products) {
    const stamp = product.updated_at;
    if (!stamp) continue;

    const time = Date.parse(stamp);
    if (Number.isNaN(time)) continue; // мусор в поле пропускаем молча, а не роняем карту

    const current = newest.get(product.category_id);
    // Сравниваем разобранные даты, а не строки: у строк бывают разные смещения,
    // и "2026-09-18T00:00:00+06:00" лексикографически больше "2026-09-18T01:00:00Z",
    // хотя на самом деле раньше.
    if (current === undefined || time > Date.parse(current)) {
      newest.set(product.category_id, stamp);
    }
  }

  return newest;
}
