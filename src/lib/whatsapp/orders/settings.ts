import "server-only";
// Runtime-настройки подсистемы из app_settings (тот же источник, что site_content):
//  - мастер-флаг нового NL/голосового пути (по умолчанию ВЫКЛ → поэтапный вывод);
//  - редактируемый владельцем список розничных позиций del Cappuccino (при отсутствии
//    берём сид DEFAULT_RETAIL_KEYWORDS). Синк с tap.delcappuccino.kz — когда его API заработает.

import { fetchAppSettings } from "@/src/lib/supabase/admin";
import { WHATSAPP_NL_ORDERS_FLAG, RETAIL_KEYWORDS_SETTING } from "./config";
import { DEFAULT_RETAIL_KEYWORDS } from "./match/retail";

function truthy(value: string | null | undefined): boolean {
  return value === "true" || value === "1" || value === "on";
}

/** Включён ли новый AI/голосовой путь оформления заказов. Ошибка чтения → false (безопасно). */
export async function isNlOrdersEnabled(): Promise<boolean> {
  try {
    const settings = await fetchAppSettings();
    return truthy(settings.find((s) => s.key === WHATSAPP_NL_ORDERS_FLAG)?.value);
  } catch {
    return false;
  }
}

/** Розничные ключевые слова (JSON-массив строк в app_settings) или сид по умолчанию. */
export async function getRetailKeywords(): Promise<string[]> {
  try {
    const settings = await fetchAppSettings();
    const raw = settings.find((s) => s.key === RETAIL_KEYWORDS_SETTING)?.value;
    if (raw) {
      const parsed = JSON.parse(raw) as unknown;
      if (Array.isArray(parsed)) {
        const list = parsed
          .filter((x): x is string => typeof x === "string" && x.trim().length > 0)
          .map((s) => s.trim());
        if (list.length > 0) return list;
      }
    }
  } catch {
    // некорректный JSON / БД недоступна → сид
  }
  return [...DEFAULT_RETAIL_KEYWORDS];
}
