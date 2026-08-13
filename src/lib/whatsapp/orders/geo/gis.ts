// Ссылки в 2ГИС для менеджера: по геометке (координаты) и по текстовому адресу.
// Чистый модуль (без сети). Город фиксирован — Алматы (доставка только по Алматы).
// ВНИМАНИЕ: точный deep-link формат 2ГИС по координатам не документирован публично —
// формат ниже (/geo/<lon>,<lat>) требует клик-проверки владельцем (см. аудит-док).

const GIS_CITY = "almaty";
const GIS_BASE = `https://2gis.kz/${GIS_CITY}`;

/** Координаты валидны и не (0,0) (частый «пустой» дефолт). */
export function isValidLatLng(lat: unknown, lng: unknown): lat is number {
  const a = Number(lat);
  const o = Number(lng);
  if (!Number.isFinite(a) || !Number.isFinite(o)) return false;
  if (a < -90 || a > 90 || o < -180 || o > 180) return false;
  if (a === 0 && o === 0) return false;
  return true;
}

/** Ссылка на точку в 2ГИС по координатам. null — координаты невалидны. 2ГИС: порядок lon,lat. */
export function build2gisPointLink(lat: number, lng: number): string | null {
  if (!isValidLatLng(lat, lng)) return null;
  // Округляем до 6 знаков (~0.1 м) — короче ссылка, точности с запасом.
  const round = (v: number) => Math.round(v * 1e6) / 1e6;
  return `${GIS_BASE}/geo/${round(lng)},${round(lat)}`;
}

/** Ссылка на поиск адреса в 2ГИС по тексту. null — пустой/бессмысленный запрос. */
export function build2gisSearchLink(query: string | null | undefined): string | null {
  const q = (query ?? "").trim();
  if (q.length < 3) return null;
  // Не строим search по строке, где уже лежит ссылка на 2ГИС (геометка).
  if (/2gis\./i.test(q)) return null;
  return `${GIS_BASE}/search/${encodeURIComponent(q)}`;
}
