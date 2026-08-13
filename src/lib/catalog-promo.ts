// Акция каталога — ЧИСТАЯ модель (без сети/сервера), покрыта тестами.
// Хранится ОТДЕЛЬНОЙ JSON-строкой в app_settings под ключом `catalog_promo`
// (таблица уже есть — миграций не требуется). Базовый price товара НЕ трогаем:
// промо-цена накладывается поверх на витрине, после акции конфиг удаляется/истекает —
// цены сами возвращаются (полностью обратимо). Загрузка/чтение — catalog-promo.server.ts.

import type { Product } from "@/src/types";

export const CATALOG_PROMO_KEY = "catalog_promo";
export const CATALOG_PROMO_CACHE_TAG = "catalog-promo";

/** Лимиты (защита от раздувания JSON и мусора). */
export const MAX_PROMO_ITEMS = 3000;
export const MAX_PROMO_PRICE = 20000; // тот же потолок, что у ручного редактора/импорта
export const MAX_PROMO_LABEL_LEN = 200;

export type CatalogPromo = {
  enabled: boolean;
  /** Текст баннера/бейджа, напр. «Скидка до 50% на всё до конца августа». */
  label: string;
  /** Последний день акции включительно, «YYYY-MM-DD», либо null = без авто-истечения. */
  activeUntil: string | null;
  /** productId → акционная цена (ниже базовой). */
  prices: Record<string, number>;
};

export const defaultCatalogPromo: CatalogPromo = {
  enabled: false,
  label: "",
  activeUntil: null,
  prices: {},
};

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Санитизация конфига перед сохранением/использованием (клампы, отсев мусора). */
export function sanitizeCatalogPromo(raw: unknown): CatalogPromo {
  if (typeof raw !== "object" || raw === null) return { ...defaultCatalogPromo };
  const value = raw as Record<string, unknown>;

  const label = typeof value.label === "string" ? value.label.slice(0, MAX_PROMO_LABEL_LEN) : "";
  const activeUntil =
    typeof value.activeUntil === "string" && DATE_RE.test(value.activeUntil) ? value.activeUntil : null;

  const prices: Record<string, number> = {};
  const rawPrices = value.prices;
  if (typeof rawPrices === "object" && rawPrices !== null) {
    for (const [id, price] of Object.entries(rawPrices as Record<string, unknown>)) {
      if (Object.keys(prices).length >= MAX_PROMO_ITEMS) break;
      const key = String(id).trim();
      const num = Number(price);
      if (key && Number.isFinite(num) && num > 0 && num <= MAX_PROMO_PRICE) {
        prices[key] = Math.round(num);
      }
    }
  }

  return { enabled: value.enabled === true, label, activeUntil, prices };
}

/** Сегодняшняя дата в поясе Алматы (UTC+5), «YYYY-MM-DD» — для проверки срока акции. */
export function almatyToday(): string {
  return new Date(Date.now() + 5 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

/** Активна ли акция на дату `todayISO` («YYYY-MM-DD»): включена, не истекла, есть цены. */
export function isPromoActive(promo: CatalogPromo | null | undefined, todayISO: string): boolean {
  if (!promo?.enabled) return false;
  if (promo.activeUntil && todayISO > promo.activeUntil) return false;
  return Object.keys(promo.prices).length > 0;
}

/** Процент скидки (целое, для бейджа «−N%»). 0, если промо не ниже базовой. */
export function discountPercent(oldPrice: number, price: number): number {
  if (!(oldPrice > 0) || !(price >= 0) || price >= oldPrice) return 0;
  return Math.round((1 - price / oldPrice) * 100);
}

/**
 * Наложить акцию на список товаров: где есть промо-цена ниже базовой — выставляем её
 * как текущую, а базовую сохраняем в oldPrice и помечаем isPromo. Промо не активна →
 * список без изменений. Товары без промо-цены не трогаем.
 */
export function applyCatalogPromo(
  products: Product[],
  promo: CatalogPromo | null | undefined,
  todayISO: string,
): Product[] {
  if (!isPromoActive(promo, todayISO)) return products;
  const prices = promo!.prices;
  return products.map((product) => {
    const sale = prices[product.id];
    if (typeof sale === "number" && sale > 0 && sale < product.price) {
      return { ...product, oldPrice: product.price, price: sale, isPromo: true };
    }
    return product;
  });
}
