// Канонизация телефона/email для таблицы clients. Чистый модуль (без server-only)
// — тестируем и переиспользуем. Телефон приводим к тому же виду, что использует
// POST /api/orders (+7XXXXXXXXXX), иначе eq.-поиск fetchClientByPhone промахнётся
// и создаст дубль (UNIQUE(phone) в БД дедупит только строго одинаковые строки).

import { normalizeKzPhone, isValidKzMobile } from "@/src/lib/phone";

/** Телефон в каноническом виде `+7XXXXXXXXXX` или null, если не валидный мобильный KZ. */
export function canonicalClientPhone(phone: string): string | null {
  if (!isValidKzMobile(phone)) return null;
  return `+${normalizeKzPhone(phone)}`;
}

/** Email в нижнем регистре без пробелов, либо null для пустого. */
export function canonicalClientEmail(email?: string | null): string | null {
  const normalized = email?.trim().toLowerCase() ?? "";
  return normalized.length > 0 ? normalized : null;
}
