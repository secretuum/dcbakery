import type { Locale } from "@/src/i18n/config";
import { withLocale } from "@/src/i18n/routing";

// Ссылки витрины на страницы товаров и категорий. Собраны в одном месте не ради
// красоты: карточка товара рисуется в четырёх местах (каталог, страница категории,
// главная, быстрый просмотр), и именно по этим ссылкам краулер добирается до 141
// страницы товаров и 9 страниц категорий — до появления ссылок они были сиротами
// и обходились только по карте сайта.
//
// Slug кодируем: withLocale режет путь по «?» и «#», так что slug с пробелом или
// решёткой (из прайса приходит что угодно) без кодирования дал бы битую ссылку.
// Обычный slug вида "tort-medovik" encodeURIComponent не меняет.

/** Путь к странице товара: /{locale}/product/{slug}. */
export function productPath(slug: string, locale: Locale): string {
  return withLocale(`/product/${encodeURIComponent(slug)}`, locale);
}

/** Путь к странице категории каталога: /{locale}/catalog/{slug}. */
export function categoryPath(slug: string, locale: Locale): string {
  return withLocale(`/catalog/${encodeURIComponent(slug)}`, locale);
}
