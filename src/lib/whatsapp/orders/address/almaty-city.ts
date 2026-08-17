// Классификация геокодированного города и свод «эвристика + геокодер» в финальный вердикт.
// Чистые функции (тестируются). Осторожно: «Алматинская ОБЛАСТЬ» (Талгар/Каскелен и т.п.) —
// это НЕ город Алматы, туда не доставляем; поэтому область/район отсекаем отдельно.

import type { AddressValidationResult } from "./provider";

export type GeocodeVerdict = "almaty" | "other" | "unknown";
export type GeocodeHit = {
  lat: number;
  lon: number;
  city: string | null;
  countryCode: string | null;
  verdict: GeocodeVerdict;
};

function norm(s: string | null | undefined): string {
  return (s ?? "").toLowerCase().replace(/ё/g, "е").trim();
}

const ALMATY_RE = /алмат|almat/;
const REGION_RE = /област|oblast|region|\bобл\b|аудан|\bрайон\b/;

/**
 * @param city  город из геокодера (properties.city/town/…)
 * @param countryCode ISO-код страны (KZ и т.п.)
 * @returns "almaty" — город Алматы; "other" — другая страна/город (не доставляем);
 *          "unknown" — не определить (пусть решает эвристика/менеджер, БЕЗ ложного отказа).
 */
export function classifyGeocode(city: string | null, countryCode: string | null): GeocodeVerdict {
  const cc = norm(countryCode);
  if (cc && cc !== "kz") return "other"; // другая страна — точно не Алматы

  const c = norm(city);
  if (!c) return "unknown"; // город не определён — не отклоняем, отдаём эвристике
  if (ALMATY_RE.test(c) && !REGION_RE.test(c)) return "almaty"; // город Алматы (не область)
  if (ALMATY_RE.test(c) && REGION_RE.test(c)) return "other"; // Алматинская область — не город
  return "other"; // внятный НЕ-алматинский город/локаль в КЗ — не доставляем
}

/**
 * Свести результат эвристики + хит геокодера в финальный вердикт. Безопасно для клиентов:
 * явные вердикты эвристики НЕ опрокидываем; геокодером решаем только НЕОДНОЗНАЧНЫЕ адреса.
 */
export function combineAddressVerdict(base: AddressValidationResult, hit: GeocodeHit | null): AddressValidationResult {
  // Явный другой город / мусорный ввод — эвристике доверяем, геокодер не нужен.
  if (base.status === "outside_almaty") return base;
  if (base.status === "uncertain" && base.reason === "too_short_or_empty") return base;
  if (!hit) return base; // геокодер недоступен

  // Эвристика уверена (в тексте «Алматы») — НЕ опрокидываем, только координаты для 2ГИС.
  if (base.status === "in_almaty") return { ...base, lat: hit.lat, lon: hit.lon };

  // Эвристика не уверена (город не назван) — доверяем вердикту геокодера.
  if (hit.verdict === "other") {
    return {
      status: "outside_almaty",
      normalized: base.normalized,
      matchedCity: hit.city ?? undefined,
      reason: "geocoder_other_city",
    };
  }
  if (hit.verdict === "almaty") {
    return {
      status: "in_almaty",
      normalized: base.normalized,
      matchedCity: "алматы",
      reason: "geocoder_almaty",
      lat: hit.lat,
      lon: hit.lon,
    };
  }
  return base; // verdict unknown → uncertain остаётся (менеджеру)
}
