// Описание карточки товара для поиска. У части позиций описание в каталоге пустое —
// тогда <meta name="description"> и Product.description уходили ПУСТЫМИ, и сниппет
// поисковик собирал сам из случайных кусков страницы. Запасной текст собирается из
// того, что про товар известно наверняка: название и раздел каталога.

import type { Translator } from "@/src/i18n/translate-core";

/** Шаблон запасного описания. Ключ словаря — эта же строка целиком (ru → kk/en). */
export const PRODUCT_DESCRIPTION_FALLBACK =
  "${name} — оптовая поставка от DC Bakery в Алматы. Раздел «${category}»: B2B-цены, доставка по городу.";

export function productMetaDescription({
  description,
  name,
  category,
  t,
}: {
  description: string | null | undefined;
  name: string;
  category: string;
  t: Translator;
}): string {
  const own = (description ?? "").trim();
  if (own) return own;

  return t(PRODUCT_DESCRIPTION_FALLBACK, { name, category });
}
