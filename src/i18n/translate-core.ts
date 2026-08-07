// Чистое ядро перевода — БЕЗ импорта самих словарей (kk.json/en.json). Поэтому его можно
// тянуть в клиентский бандл, не утаскивая туда ~272 КБ JSON. Активный словарь подставляет
// вызывающий: на сервере — из статических карт (translate.ts), на клиенте — из провайдера,
// куда он приходит пропом с сервера.

export type TranslateVars = Record<string, string | number>;
export type Translator = (text: string, vars?: TranslateVars) => string;

/** Словарь локали (русская строка-ключ → перевод) либо null (ru / нет словаря → оригинал). */
export type Dictionary = Record<string, string> | null;

export function translateWith(dict: Dictionary, text: string, vars?: TranslateVars): string {
  // Ключи словаря собраны со схлопнутыми пробелами — строки с \n ищем так же.
  let result = dict ? dict[text] ?? dict[text.replace(/\s+/g, " ").trim()] ?? text : text;

  if (vars) {
    for (const [key, value] of Object.entries(vars)) {
      result = result.split(`\${${key}}`).join(String(value));
    }
  }

  return result;
}
