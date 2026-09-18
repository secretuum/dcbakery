// ItemList для страниц-списков (каталог и его разделы). Без него поисковик и
// ИИ-ассистенты видят на странице раздела только текст и картинки и не понимают,
// что это перечень товаров, какой он длины и куда ведёт каждая позиция.
//
// Перечисляем ровно то, что реально отрисовано на странице: ссылка + название в
// порядке вывода. Цены и наличие здесь НЕ дублируем — они живут в Product на самой
// карточке товара, и расхождение двух источников хуже отсутствия одного.

export type ItemListEntry = {
  name: string;
  url: string;
};

export function buildItemListJsonLd({
  name,
  url,
  items,
}: {
  /** Название списка — обычно заголовок раздела. */
  name: string;
  /** Абсолютный адрес самой страницы-списка. */
  url: string;
  items: ItemListEntry[];
}): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name,
    url,
    numberOfItems: items.length,
    // Порядок значим: он совпадает с порядком вывода на странице.
    itemListOrder: "https://schema.org/ItemListOrderAscending",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      url: item.url,
    })),
  };
}
