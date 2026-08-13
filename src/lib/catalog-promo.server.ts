import "server-only";
import { unstable_cache, revalidateTag } from "next/cache";
import { fetchAppSetting, upsertAppSetting } from "@/src/lib/supabase/admin";
import {
  CATALOG_PROMO_KEY,
  CATALOG_PROMO_CACHE_TAG,
  defaultCatalogPromo,
  sanitizeCatalogPromo,
  type CatalogPromo,
} from "@/src/lib/catalog-promo";

// Чтение конфига акции из app_settings['catalog_promo']. Кэшируем на инстанс (в БД
// ходим не чаще revalidate-окна), правки видны сразу через revalidateTag на записи.
// Узким запросом (fetchAppSetting), не SELECT * всей app_settings — меньше egress.
const loadCatalogPromo = unstable_cache(
  async (): Promise<CatalogPromo> => {
    try {
      const raw = await fetchAppSetting(CATALOG_PROMO_KEY);
      if (!raw) return { ...defaultCatalogPromo };
      return sanitizeCatalogPromo(JSON.parse(raw));
    } catch {
      return { ...defaultCatalogPromo };
    }
  },
  ["catalog-promo-v1"],
  { revalidate: 3600, tags: [CATALOG_PROMO_CACHE_TAG] },
);

export async function getCatalogPromo(): Promise<CatalogPromo> {
  return loadCatalogPromo();
}

/**
 * Сохранить конфиг акции (санитизируется) + сбросить кэш промо. Каталог-тег и пути
 * ревалидирует вызывающий роут (как в import/apply) — чтобы не тянуть catalog.ts сюда.
 */
export async function writeCatalogPromo(promo: CatalogPromo): Promise<CatalogPromo> {
  const clean = sanitizeCatalogPromo(promo);
  await upsertAppSetting(CATALOG_PROMO_KEY, JSON.stringify(clean));
  revalidateTag(CATALOG_PROMO_CACHE_TAG, "max");
  return clean;
}
