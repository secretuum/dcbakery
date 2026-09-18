// Абсолютные URL для метаданных и Schema.org: og:image, Product.image и <image:loc>
// в карте сайта требуют ПОЛНЫЙ адрес, относительный путь там не годится.
//
// Фото товара приходит из двух источников: из репозитория относительным путём
// ("/products/tort-medovik.webp") и из админки — уже абсолютной ссылкой на Supabase
// Storage ("https://<ref>.supabase.co/storage/..."). Наивная склейка `${SITE_URL}${image}`
// на втором случае давала "https://dc-bakery.kzhttps://<ref>.supabase.co/...", а при
// резолве метаданных new URL(...) съедал двоеточие и превращал это в host
// "dc-bakery.kzhttps" — превью ссылки на товар было сломано у ВСЕХ фото из админки.

import { SITE_URL } from "@/src/lib/site-url";

/**
 * Путь картинки/страницы → абсолютный URL. Уже абсолютный адрес отдаётся как есть,
 * протокол-относительный ("//host/x") получает схему, пустое значение → undefined
 * (вызывающий подставляет запасную картинку или опускает поле целиком).
 */
export function toAbsoluteUrl(src: string | null | undefined): string | undefined {
  if (typeof src !== "string") return undefined;

  const value = src.trim();
  if (!value) return undefined;

  if (/^https?:\/\//i.test(value)) return value;
  if (value.startsWith("//")) return `https:${value}`;

  return `${SITE_URL}${value.startsWith("/") ? "" : "/"}${value}`;
}
