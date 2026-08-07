import "server-only";
import kk from "@/src/i18n/kk.json";
import en from "@/src/i18n/en.json";
import type { Locale } from "@/src/i18n/config";
import { translateWith, type Dictionary, type TranslateVars } from "@/src/i18n/translate-core";

export type { TranslateVars, Translator } from "@/src/i18n/translate-core";

// Перевод по исходной русской строке. Строка не найдена в словаре — возвращается русский
// оригинал (безопасный фолбэк для нового текста). Подстановки вида ${имя} — из vars.
//
// ВАЖНО: этот модуль `server-only` и статически бандлит оба словаря — но ТОЛЬКО в серверный
// бандл. На клиент активный словарь уезжает пропом в LocaleProvider (см. app/layout.tsx),
// поэтому 272 КБ JSON в клиентский бандл больше не попадают. Логика перевода — в
// translate-core (без импорта словарей), общая для сервера и клиента.

const maps: Record<Exclude<Locale, "ru">, Record<string, string>> = {
  kk: kk as Record<string, string>,
  en: en as Record<string, string>,
};

/** Активный словарь локали — для передачи на клиент. null для ru (переводов нет). */
export function getDictionary(locale: Locale): Dictionary {
  return locale === "ru" ? null : maps[locale] ?? null;
}

export function translate(locale: Locale, text: string, vars?: TranslateVars): string {
  return translateWith(getDictionary(locale), text, vars);
}
