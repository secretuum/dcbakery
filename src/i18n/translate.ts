import kk from "@/src/i18n/kk.json";
import en from "@/src/i18n/en.json";
import type { Locale } from "@/src/i18n/config";

// Перевод по исходной русской строке. Строка не найдена в словаре —
// возвращается русский оригинал (безопасный фолбэк для нового текста).
// Подстановки вида ${имя} заполняются из vars после перевода.

const maps: Record<Exclude<Locale, "ru">, Record<string, string>> = {
  kk: kk as Record<string, string>,
  en: en as Record<string, string>,
};

export type TranslateVars = Record<string, string | number>;

export function translate(locale: Locale, text: string, vars?: TranslateVars) {
  let result: string;

  if (locale === "ru") {
    result = text;
  } else {
    // Ключи словаря собраны со схлопнутыми пробелами — строки с \n ищем так же
    result = maps[locale][text] ?? maps[locale][text.replace(/\s+/g, " ").trim()] ?? text;
  }

  if (vars) {
    for (const [key, value] of Object.entries(vars)) {
      result = result.split(`\${${key}}`).join(String(value));
    }
  }

  return result;
}

export type Translator = (text: string, vars?: TranslateVars) => string;
