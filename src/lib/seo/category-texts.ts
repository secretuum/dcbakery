/**
 * Тексты страниц разделов каталога (/catalog/[category]) для поиска: заголовок,
 * описание и короткий блок фактов о разделе.
 *
 * Лежат здесь, а не в categoryDetails из src/lib/catalog.ts, по двум причинам:
 * catalog.ts тянет supabase и next/cache и в тест-раннере не грузится, а сторожам
 * SEO (category-texts.test.ts, metadata-uniqueness.test.ts) нужны настоящие строки,
 * а не шаблон `${categoryName} | …` в исходнике страницы.
 *
 * Все строки — русские исходники и одновременно ключи словарей src/i18n/*.json,
 * как у t() во всём сайте.
 */

export type CategoryTexts = {
  /** Заголовок для выдачи без бренда: бренд дописывает categoryMetaTitle. */
  title: string;
  description: string;
};

export const CATEGORY_TEXTS: Record<string, CategoryTexts> = {
  deserty: {
    title: "Десерты",
    description: "Порционные десерты, торты и позиции для витрины кофеен, ресторанов и магазинов.",
  },
  polufabrikaty: {
    title: "Полуфабрикаты",
    description: "Заморозка и заготовки для стабильной кухни, быстрых завтраков и витрин.",
  },
  myaso: {
    title: "Мясо",
    description: "Мясные позиции для меню, доставки, бизнес-ланчей и продуктовой полки.",
  },
};

export function categoryTexts(slug: string): CategoryTexts | undefined {
  return CATEGORY_TEXTS[slug];
}

/**
 * <title> раздела ровно в том виде, в каком его отдаёт страница. Одна функция на
 * страницу и на сторожей: иначе тест мерил бы свою копию шаблона, а не то, что
 * видит поиск.
 */
export function categoryMetaTitle(texts: CategoryTexts, t: (ru: string) => string): string {
  return `${t(texts.title)} | ${t("Каталог DC Bakery")}`;
}
