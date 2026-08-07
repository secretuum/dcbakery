import "server-only";
import { unstable_cache } from "next/cache";
import { fetchAppSetting } from "@/src/lib/supabase/admin";

// Редактируемый контент сайта. Хранится одной JSON-строкой в app_settings
// под ключом site_content (таблица уже существует — миграций не требуется).
// Всё, чего нет в сохранённом JSON, берётся из значений по умолчанию ниже.

export type SiteContent = {
  /** WhatsApp-бот для заявок */
  contactWhatsapp: string;
  /** Телефон (руководитель цеха) */
  contactPhone: string;
  address: string;
  workHours: string;
  /** Дни доставки: 0 = воскресенье … 6 = суббота */
  deliveryDays: number[];
  /** Приём заявок до этого часа накануне дня доставки */
  orderCutoffHour: number;
  heroTitle: string;
  heroSubtitle: string;
  aboutTitle: string;
  aboutText: string;
};

export const SITE_CONTENT_KEY = "site_content";

/** Лимиты произвольных override-ключей (защита от разрастания JSON). */
export const MAX_OVERRIDE_KEYS = 800;
export const MAX_OVERRIDE_VALUE_LENGTH = 5000;

/** Значение редактируемого текста по id: сохранённый override или запасной текст. */
export function siteText(content: Record<string, unknown>, id: string, fallback: string): string {
  const value = content[id];
  return typeof value === "string" && value.trim() ? value : fallback;
}

export const defaultSiteContent: SiteContent = {
  contactWhatsapp: "+7 747 727 2650",
  contactPhone: "+7 747 694 0766",
  address: "г. Алматы, ул. Жамбыла 154",
  workHours: "Пн–Пт 9:00–19:00",
  deliveryDays: [2, 4, 6],
  orderCutoffHour: 18,
  heroTitle: "Надёжные поставки\nдля вашего бизнеса",
  heroSubtitle:
    "Десерты, полуфабрикаты и мясо для кофеен, ресторанов, отелей и магазинов. Оптовые цены, живые остатки, история заказов — всё в одном кабинете.",
  aboutTitle: "DC Bakery — B2B поставщик еды в Казахстане",
  aboutText:
    "Мы специализируемся на поставках продуктов питания для B2B-сегмента: кофеен, ресторанов, гостиниц и магазинов. Работаем с 50+ партнёрами по всему Казахстану.",
};

const dayLabels = ["Воскресенье", "Понедельник", "Вторник", "Среда", "Четверг", "Пятница", "Суббота"];

export function formatDeliveryDaysLabel(days: number[]) {
  return days
    .slice()
    .sort((a, b) => (a === 0 ? 7 : a) - (b === 0 ? 7 : b))
    .map((d) => dayLabels[d] ?? "")
    .filter(Boolean)
    .join(" · ");
}

function sanitize(raw: unknown): Partial<SiteContent> {
  if (typeof raw !== "object" || raw === null) {
    return {};
  }

  const value = raw as Record<string, unknown>;
  const result: Partial<SiteContent> = {};

  for (const key of [
    "contactWhatsapp",
    "contactPhone",
    "address",
    "workHours",
    "heroTitle",
    "heroSubtitle",
    "aboutTitle",
    "aboutText",
  ] as const) {
    if (typeof value[key] === "string" && value[key].trim()) {
      result[key] = (value[key] as string).trim();
    }
  }

  if (Array.isArray(value.deliveryDays)) {
    const days = value.deliveryDays
      .map((d) => Number(d))
      .filter((d) => Number.isInteger(d) && d >= 0 && d <= 6);
    if (days.length > 0) {
      result.deliveryDays = [...new Set(days)];
    }
  }

  const cutoff = Number(value.orderCutoffHour);
  if (Number.isInteger(cutoff) && cutoff >= 0 && cutoff <= 23) {
    result.orderCutoffHour = cutoff;
  }

  // Произвольные строковые ключи (любая деталь сайта, обёрнутая в EditableText
  // с уникальным id). Типизированные поля и числовые настройки выше уже учтены.
  const RESERVED = new Set<string>([
    "contactWhatsapp", "contactPhone", "address", "workHours",
    "heroTitle", "heroSubtitle", "aboutTitle", "aboutText",
    "deliveryDays", "orderCutoffHour",
    "__proto__", "constructor", "prototype",
  ]);
  const extra = result as Record<string, string>;
  let extraCount = 0;
  for (const key of Object.keys(value)) {
    if (RESERVED.has(key) || extraCount >= MAX_OVERRIDE_KEYS) continue;
    const v = value[key];
    if (typeof v === "string" && v.trim() && v.length <= MAX_OVERRIDE_VALUE_LENGTH) {
      extra[key] = v.trim();
      extraCount++;
    }
  }

  return result;
}

/** Тег кэша контента сайта — сбрасывается при сохранении в /api/admin/settings. */
export const SITE_CONTENT_CACHE_TAG = "site-content";

// Контент сайта читается в layout НА КАЖДЫЙ рендер. Кэшируем на весь инстанс: реально в БД
// ходим не чаще раза в revalidate-окно, а правки суперадмина мгновенно видны через
// revalidateTag. На чтении берём УЗКИМ запросом только строку site_content (fetchAppSetting),
// а не `SELECT *` всей app_settings с крупным home_layout — меньше egress на ревалидации.
const loadSiteContent = unstable_cache(
  async (): Promise<SiteContent> => {
    try {
      const raw = await fetchAppSetting(SITE_CONTENT_KEY);

      if (!raw) {
        return defaultSiteContent;
      }

      return { ...defaultSiteContent, ...sanitize(JSON.parse(raw)) };
    } catch {
      return defaultSiteContent;
    }
  },
  ["site-content-v1"],
  // Контент меняется редко (ручные правки суперадмина) → длинное фоновое окно;
  // правки видны сразу через revalidateTag в /api/admin/settings.
  { revalidate: 3600, tags: [SITE_CONTENT_CACHE_TAG] },
);

export async function getSiteContent(): Promise<SiteContent> {
  return loadSiteContent();
}
