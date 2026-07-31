// Распознавание РОЗНИЧНЫХ позиций del Cappuccino (кафе/бар), которых нет в B2B-каталоге
// DC Bakery. Источник ключевых слов — редактируемый список в app_settings
// (RETAIL_KEYWORDS_SETTING); здесь — только чистая логика сопоставления + сид-набор
// очевидных кафе-позиций (напитки/кухня). Реальный перечень с tap.delcappuccino.kz
// подключается в settings-слое, когда его API заработает.
//
// ВАЖНО (порядок в matcher): сначала проверяем B2B-каталог. Розничным считаем ТОЛЬКО
// то, что НЕ нашлось в B2B и совпало с розничным списком. Неизвестное розницей не
// объявляем.

import { normalizeText, stemmedTokens } from "../text/normalize";

/**
 * Сид розничных ключевых слов: бар (напитки) + кухня (горячее/завтраки).
 * ДЕСЕРТЫ намеренно НЕ включены — они у DC Bakery оптовые (B2B) и проверяются раньше.
 */
export const DEFAULT_RETAIL_KEYWORDS: readonly string[] = [
  // Бар — кофе и напитки
  "капучино",
  "латте",
  "эспрессо",
  "американо",
  "раф",
  "флэт уайт",
  "макиато",
  "мокко",
  "какао",
  "горячий шоколад",
  "матча",
  "чай",
  "смузи",
  "милкшейк",
  "фраппе",
  "лимонад",
  "коктейль",
  "фреш",
  // Кухня — горячее и завтраки
  "паста",
  "альфредо",
  "карбонара",
  "болоньезе",
  "сэндвич",
  "сендвич",
  "бургер",
  "пицца",
  "салат",
  "суп",
  "завтрак",
  "омлет",
  "скрэмбл",
  "тост",
  "боул",
  "шакшука",
];

export type RetailMatch = { isRetail: boolean; keyword?: string };

/**
 * Совпадает ли «сырое» название с розничным списком.
 * Матч: нормализованное вхождение подстрокой ИЛИ все стем-токены ключевого слова
 * присутствуют в стем-токенах запроса (напр. «пасты альфредо» → «паста»,«альфредо»).
 */
export function matchRetail(rawName: string, keywords: readonly string[]): RetailMatch {
  const qn = normalizeText(rawName);
  if (!qn) return { isRetail: false };
  const qSet = new Set(stemmedTokens(rawName));

  for (const kw of keywords) {
    const kn = normalizeText(kw);
    if (!kn) continue;
    if (qn.includes(kn)) return { isRetail: true, keyword: kw };
    const kwTokens = stemmedTokens(kw);
    if (kwTokens.length > 0 && kwTokens.every((t) => qSet.has(t))) {
      return { isRetail: true, keyword: kw };
    }
  }
  return { isRetail: false };
}
