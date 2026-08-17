import "server-only";
// Геокодер адреса через бесплатный OSM (Photon от Komoot) — БЕЗ ключа. Используется, чтобы
// подтвердить, что адрес в Алматы (иначе не доставляем) и получить координаты для точной
// 2ГИС-ссылки. НЕ основной путь: вызываем только для НЕОДНОЗНАЧНЫХ адресов (см. geocoder-
// provider), результат кэшировать/фолбэчить на эвристику. Соблюдаем usage policy OSM
// (User-Agent, низкий объём). Эндпоинт настраивается env (можно свой self-hosted Photon).

import { classifyGeocode, type GeocodeHit } from "./almaty-city";

const GEOCODER_URL = process.env.GEOCODER_URL ?? "https://photon.komoot.io/api";
const GEOCODER_UA = process.env.GEOCODER_USER_AGENT ?? "DC-Bakery-bot (+https://dc-bakery.kz)";
// Смещение поиска к центру Алматы, чтобы «Абая 10» ранжировалось как алматинский адрес.
const ALMATY_LAT = 43.238;
const ALMATY_LON = 76.945;

function firstString(...vals: unknown[]): string | null {
  for (const v of vals) if (typeof v === "string" && v.trim()) return v.trim();
  return null;
}

/** Геокодировать адрес. null — не нашли/ошибка/таймаут (вызывающий падает на эвристику). */
export async function geocodeAddress(query: string, timeoutMs = 5000): Promise<GeocodeHit | null> {
  const q = query.trim();
  if (q.length < 4) return null;

  const url = `${GEOCODER_URL}?q=${encodeURIComponent(q)}&limit=1&lang=ru&lat=${ALMATY_LAT}&lon=${ALMATY_LON}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": GEOCODER_UA, Accept: "application/json" },
      signal: controller.signal,
      cache: "no-store",
    });
    if (!res.ok) return null;
    const data = (await res.json()) as {
      features?: Array<{ geometry?: { coordinates?: [number, number] }; properties?: Record<string, unknown> }>;
    };
    const feat = data.features?.[0];
    const coords = feat?.geometry?.coordinates;
    if (!coords || coords.length !== 2) return null;
    const [lon, lat] = coords;
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;

    const p = feat?.properties ?? {};
    const city = firstString(p.city, p.town, p.locality, p.district, p.county);
    const countryCode = firstString(p.countrycode);
    return { lat, lon, city, countryCode, verdict: classifyGeocode(city, countryCode) };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}
