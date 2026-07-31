// Сопоставление «сырого» названия из сообщения клиента с РЕАЛЬНЫМ каталогом.
// Чистая функция: каталог (Product[]) приходит извне (fetchCatalogProducts) — своей
// копии каталога НЕ держим. Возвращает классификацию b2b | retail | unknown и, при
// неоднозначности/неизвестности, до 3 ближайших РЕАЛЬНО существующих B2B-товаров.
//
// Порядок классификации (см. ТЗ):
//  1) уверенный матч в B2B-каталоге → b2b;
//  2) иначе совпадение с розничным списком → retail (ссылка на del Cappuccino);
//  3) иначе → unknown (+ до 3 похожих B2B для уточнения).

import type { Product } from "@/src/types";
import { LIMITS } from "../config";
import { normalizeText, stemmedTokens, levenshtein } from "../text/normalize";
import { matchRetail } from "./retail";

export type MatchKind = "b2b" | "retail" | "unknown";

export type MatchCandidate = { product: Product; score: number };

export type ClassifiedItem = {
  rawName: string;
  kind: MatchKind;
  /** Товар при kind==='b2b'. */
  product?: Product;
  /** Розничное ключевое слово при kind==='retail'. */
  retailKeyword?: string;
  /** До 3 ближайших B2B-товаров (для уточнения/«вы имели в виду»). */
  candidates: MatchCandidate[];
};

// Порог уверенности матча и минимальный отрыв от второго кандидата (иначе — неоднозначно).
const MATCH_THRESHOLD = 0.6;
const AMBIGUITY_MARGIN = 0.15;

function productHaystack(product: Product): string[] {
  return stemmedTokens(`${product.name} ${product.subcategory ?? ""}`);
}

function scoreProduct(queryTokens: string[], queryNorm: string, product: Product): number {
  const nameTokens = productHaystack(product);
  if (!nameTokens.length || !queryTokens.length) return 0;
  const nameSet = new Set(nameTokens);

  let matched = 0;
  for (const qt of queryTokens) {
    if (nameSet.has(qt)) {
      matched += 1;
      continue;
    }
    let hit = 0;
    for (const nt of nameTokens) {
      // Префикс/общий корень (стемминг расходится: «медов»↔«медовик»).
      if (qt.length >= 4 && nt.length >= 4 && (nt.startsWith(qt) || qt.startsWith(nt))) {
        hit = 0.9;
        break;
      }
      // Опечатка: расстояние Левенштейна ≤1 для достаточно длинных токенов.
      if (qt.length >= 4 && Math.abs(nt.length - qt.length) <= 1 && levenshtein(qt, nt) <= 1) {
        hit = 0.8;
      }
    }
    matched += hit;
  }

  const coverage = matched / queryTokens.length; // какую долю запроса покрыли
  const nameNorm = normalizeText(product.name);
  const substringBonus = nameNorm.includes(queryNorm) || queryNorm.includes(nameNorm) ? 0.3 : 0;
  return coverage + substringBonus;
}

/** Ранжировать B2B-каталог по близости к «сырому» названию (топ-N, score>0). */
export function rankB2bCandidates(rawName: string, products: Product[]): MatchCandidate[] {
  const queryTokens = stemmedTokens(rawName);
  const queryNorm = normalizeText(rawName);
  return products
    .map((product) => ({ product, score: scoreProduct(queryTokens, queryNorm, product) }))
    .filter((c) => c.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, LIMITS.similarSuggestions);
}

/**
 * Классифицировать одну позицию.
 * @param products         — актуальный B2B-каталог (fetchCatalogProducts).
 * @param retailKeywords   — розничный список (из app_settings / сид).
 */
export function classifyItem(
  rawName: string,
  products: Product[],
  retailKeywords: readonly string[],
): ClassifiedItem {
  const candidates = rankB2bCandidates(rawName, products);
  const best = candidates[0];
  const second = candidates[1];

  const confident =
    best &&
    best.score >= MATCH_THRESHOLD &&
    (candidates.length === 1 || best.score - (second?.score ?? 0) >= AMBIGUITY_MARGIN || best.score >= 0.9);

  if (confident && best) {
    return { rawName, kind: "b2b", product: best.product, candidates };
  }

  // Не нашли уверенно в B2B — пробуем розницу (только теперь, не раньше).
  const retail = matchRetail(rawName, retailKeywords);
  if (retail.isRetail) {
    return { rawName, kind: "retail", retailKeyword: retail.keyword, candidates };
  }

  return { rawName, kind: "unknown", candidates };
}
