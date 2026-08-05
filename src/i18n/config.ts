// Языки сайта. Русский — исходный язык интерфейса, словари kk/en
// построены по нему (ключ карты = русская строка).

export const LOCALES = ["kk", "ru", "en"] as const;

export type Locale = (typeof LOCALES)[number];

// Язык по умолчанию/фолбэк — русский (язык закупочных запросов; большинство в КЗ
// читает по-русски). Служит и x-default для hreflang, и выбором для «голых» URL
// без cookie/Accept-Language. Выбор пользователя далее хранится в cookie/URL.
export const DEFAULT_LOCALE: Locale = "ru";

export const LOCALE_COOKIE = "NEXT_LOCALE";

export const localeLabels: Record<Locale, string> = {
  ru: "Рус",
  kk: "Қаз",
  en: "Eng",
};

// hreflang-коды (BCP-47) для alternate-ссылок. en — язык без региона.
export const HREFLANG: Record<Locale, string> = {
  ru: "ru-KZ",
  kk: "kk-KZ",
  en: "en",
};

export function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && (LOCALES as readonly string[]).includes(value);
}
