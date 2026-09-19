// Канонический публичный URL сайта (для метаданных, sitemap, robots, OG,
// canonical). Значение приводится к канонической форме: схема https, хост без
// www, без хвостового слэша. Если в NEXT_PUBLIC_SITE_URL забыли https:// —
// добавляем, иначе new URL(...) роняет сборку (ERR_INVALID_URL).

const DEFAULT_SITE_URL = "https://dc-bakery.kz";

/**
 * Приведение значения из переменной окружения к каноническому адресу.
 *
 * Экспортируется РАДИ ТЕСТОВ и только ради них: SITE_URL считается из
 * process.env один раз при импорте модуля, поэтому проверить поведение на
 * разных значениях, не вызывая функцию напрямую, нельзя. Не прячьте обратно.
 *
 * Правила ровно три, и каждое лечит раздвоение страниц в индексе:
 *  - схема поднимается до https: http-адрес для поиска — ДРУГОЙ сайт;
 *  - ведущий www у хоста снимается: канонический хост у нас без www;
 *  - хвостовой слэш срезается, иначе склейка даст «//ru».
 *
 * Значение не обязано быть верным: переменную задаёт человек, и кривое значение
 * (например, в .env слиплось со следующей строкой → пробел внутри) НЕ должно
 * ронять весь сайт через new URL(SITE_URL) в метаданных. Не парсится — откат
 * на дефолт.
 */
export function normalizeSiteUrl(raw: string): string {
  const trimmed = raw.trim().replace(/\/+$/, "");
  const candidate = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  try {
    const url = new URL(candidate);
    url.protocol = "https:";
    url.hostname = url.hostname.replace(/^www\./i, "");
    // URL всегда отдаёт корень со слэшем («https://dc-bakery.kz/») — срезаем его
    // обратно, адреса ниже по коду склеиваются как `${SITE_URL}/${locale}`.
    return url.toString().replace(/\/+$/, "");
  } catch {
    return DEFAULT_SITE_URL;
  }
}

export const SITE_URL = normalizeSiteUrl(
  process.env.NEXT_PUBLIC_SITE_URL || DEFAULT_SITE_URL,
);
