// Канонический публичный URL сайта (для метаданных, sitemap, robots, OG,
// canonical). Схема гарантируется: если в NEXT_PUBLIC_SITE_URL забыли
// https:// — добавляем, иначе new URL(...) роняет сборку (ERR_INVALID_URL).

const DEFAULT_SITE_URL = "https://dc-bakery.kz";

function normalizeSiteUrl(raw: string): string {
  const trimmed = raw.trim().replace(/\/+$/, "");
  const candidate = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  try {
    // Битое значение (напр. в .env слиплось со следующей строкой → пробел внутри) НЕ должно
    // ронять весь сайт через new URL(SITE_URL) в метаданных. Не парсится — откат на дефолт.
    new URL(candidate);
    return candidate;
  } catch {
    return DEFAULT_SITE_URL;
  }
}

export const SITE_URL = normalizeSiteUrl(
  process.env.NEXT_PUBLIC_SITE_URL || DEFAULT_SITE_URL,
);
