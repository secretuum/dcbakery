// Детектор попыток prompt-injection и манипуляций ценой/оплатой/правилами.
// Это ВТОРОЙ эшелон защиты (архитектурный — первый в том, что AI не имеет доступа
// к БД/инструментам, а цена всегда серверная). Здесь — только пометки для журнала и
// для срезания подозрительных «позиций»; поведение системы от этих фраз НЕ меняется.
// Чистый модуль (regex по нормализованному тексту), без сети/БД.

import { normalizeText } from "../text/normalize";

// Манипуляции ценой/оплатой/скидкой/счётом. Обнаружение → просто игнорируем фразу.
// ВАЖНО: работаем по УЖЕ нормализованному тексту (нижний регистр, ё→е). В JS `\w`/`\b`
// НЕ матчат кириллицу — поэтому используем явные классы [а-яa-z].
const PRICE_PAYMENT_PATTERNS: readonly RegExp[] = [
  /беспл?атн/,
  /за\s*спасибо/,
  /скидк[а-я]*\s*(100|сто|полн)/,
  /(100|сто)\s*процент[а-я]*\s*скидк/,
  /по\s*1\s*(тенге|тг|₸)/,
  /за\s*1\s*(тенге|тг|₸)/,
  /по\s*рубл/,
  /не\s*выставля/,
  /без\s*(оплат|счет|инвойс)/,
  /не\s*плачу/,
  /подар(ок|и|ите|ю)/,
  /в\s*долг\s*навсегда/,
  /отсрочк[а-я]*\s*(навсегда|бесконечн)/,
  /обнул[а-я]*\s*(цен|сумм|счет)/,
];

// Классические prompt-injection формулировки.
const INJECTION_PATTERNS: readonly RegExp[] = [
  /ignore\s+(all\s+)?(previous|prior|above)\s+instructions/,
  /игнорир[а-я]*\s+(все\s+)?(предыдущ|прошл|выше|инструкц)/,
  /disregard\s+(the\s+)?(system|previous)/,
  /system\s*prompt/,
  /систем[а-я]*\s*промпт/,
  /покажи\s+(системн|скрыт|секрет)/,
  /reveal\s+(the\s+)?(system|prompt|secret)/,
  /you\s+are\s+now\s+(a|an|dan)/,
  /act\s+as\s+(a|an|admin|root|developer)/,
  /ты\s+теперь\s+(админ|root|разработчик)/,
  /я\s+(админ|администратор|разработчик|root)/,
  /i\s*am\s*(the\s*)?(admin|administrator|root|developer)/,
  /(execute|run|drop|select|insert|update|delete)\s+(sql|from|into|table|orders|clients)/,
  /выполни\s+(sql|запрос|команд)/,
  /отправь\s+(базу|таблиц|клиент|данные|дамп)/,
  /send\s+(the\s+)?(database|table|dump|customers)/,
  /(скачай|перейди|открой)\s+(по\s+)?ссылк/,
  /(download|fetch|open|visit)\s+(the\s+)?(url|link|file)/,
  /вызови\s+(инструмент|функц|tool)/,
  /call\s+(the\s+)?(tool|function)/,
  /curl|wget|http:\/\/|https:\/\//,
  /<script|onerror=|javascript:/,
  /\.\.\/|\.\.\\|\/etc\/passwd/,
];

export type InjectionScan = {
  /** Найдена манипуляция ценой/оплатой (для журнала; поведение не меняем). */
  priceManipulation: boolean;
  /** Найдена prompt-injection / попытка выполнить действие (для журнала). */
  injection: boolean;
  /** Короткие метки сработавших паттернов (без сырого пользовательского текста в логах). */
  labels: string[];
};

/** Просканировать НЕДОВЕРЕННЫЙ текст на манипуляции/инъекции. Возвращает только флаги. */
export function scanForInjection(rawText: string): InjectionScan {
  const text = normalizeText(rawText);
  const labels: string[] = [];

  const priceManipulation = PRICE_PAYMENT_PATTERNS.some((re) => re.test(text));
  if (priceManipulation) labels.push("price_payment");

  const injection = INJECTION_PATTERNS.some((re) => re.test(text));
  if (injection) labels.push("prompt_injection");

  return { priceManipulation, injection, labels };
}

/** true, если «позиция» на самом деле является манипулятивной фразой, а не товаром. */
export function isManipulativeItemName(rawName: string): boolean {
  const text = normalizeText(rawName);
  return (
    PRICE_PAYMENT_PATTERNS.some((re) => re.test(text)) ||
    INJECTION_PATTERNS.some((re) => re.test(text))
  );
}
