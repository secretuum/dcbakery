// Правило пометок пропусков для выгрузки носителю (scripts/i18n-export.mjs).
//
// Файл не импортируется сайтом — только скриптом выгрузки и тестом. Лежит в src/, потому
// что npm test берёт только src/**/*.test.ts. Без импортов: скрипт грузит его нативным
// TS-стриппингом Node, и резолвер тестов ему не нужен.
//
// Зачем правило: до 21.09.2026 пропуск помечался, только если строки нет в ОБОИХ словарях.
// Односторонний пропуск уезжал носителю пустой клеткой без предупреждения — «кг» есть
// в en.json и нет в kk.json, значит казахская версия сайта показывает её по-русски.
//
// Казахский пропуск — громкий: казахскую колонку носитель и заполняет, это его работа.
// Английский — тихий: английская версия не его забота, достаточно отметки в клетке.

export type Dictionary = Record<string, string>;

export type Gap = "both" | "kk" | "en" | null;

const has = (dict: Dictionary, text: string) =>
  Object.prototype.hasOwnProperty.call(dict, text) && typeof dict[text] === "string" && dict[text].trim() !== "";

/** Какого перевода нет у строки: обоих, только казахского, только английского или никакого. */
export function gapOf(text: string, kk: Dictionary, en: Dictionary): Gap {
  const inKk = has(kk, text);
  const inEn = has(en, text);
  if (!inKk && !inEn) return "both";
  if (!inKk) return "kk";
  if (!inEn) return "en";
  return null;
}

/** Громкий статус пропуска для колонки «Статус»; null — статус ставится по истории выгрузок. */
export const STATUS_MISSING = "**НЕТ В СЛОВАРЕ — перевода нет**";
export const STATUS_MISSING_KK = "**НЕТ КАЗАХСКОГО ПЕРЕВОДА**";

export function gapStatus(gap: Gap): string | null {
  if (gap === "both") return STATUS_MISSING;
  if (gap === "kk") return STATUS_MISSING_KK;
  return null;
}

/** Тихая отметка в клетке «English», когда английского перевода нет. */
export const EN_MISSING_MARK = "_нет в en.json_";

export function englishCell(gap: Gap, value: string): string {
  return gap === "both" || gap === "en" ? EN_MISSING_MARK : value;
}

/**
 * Граница «НОВОЕ с даты» для `git rev-list --before`: начало суток по Алматы (UTC+5).
 * Голую дату «2026-09-18» git понимает как 18.09 в ТЕКУЩИЙ час запуска — статусы
 * тогда зависели от времени суток, и два прогона одного коммита расходились.
 */
export function newSinceBoundary(date: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error(`дата ожидается в виде ГГГГ-ММ-ДД, получено «${date}»`);
  return `${date}T00:00:00+05:00`;
}
