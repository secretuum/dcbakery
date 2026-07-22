// Канонический публичный URL сайта (для метаданных, sitemap, robots, OG,
// canonical). Схема гарантируется: если в NEXT_PUBLIC_SITE_URL забыли
// https:// — добавляем, иначе new URL(...) роняет сборку (ERR_INVALID_URL).

function normalizeSiteUrl(raw: string): string {
  const trimmed = raw.trim().replace(/\/+$/, "");
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
}

export const SITE_URL = normalizeSiteUrl(
  process.env.NEXT_PUBLIC_SITE_URL || "https://dc-bakery.kz",
);
