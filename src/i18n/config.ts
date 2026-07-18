// Языки сайта. Русский — исходный язык интерфейса, словари kk/en
// построены по нему (ключ карты = русская строка).

export const LOCALES = ["ru", "kk", "en"] as const;

export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = "ru";

export const LOCALE_COOKIE = "NEXT_LOCALE";

export const localeLabels: Record<Locale, string> = {
  ru: "Рус",
  kk: "Қаз",
  en: "Eng",
};

export function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && (LOCALES as readonly string[]).includes(value);
}
