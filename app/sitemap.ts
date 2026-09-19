import type { MetadataRoute } from "next";
import { fetchCategories, fetchProducts } from "@/src/lib/catalog";
import { SITE_URL } from "@/src/lib/site-url";
import { HREFLANG, LOCALES } from "@/src/i18n/config";
import { toAbsoluteUrl } from "@/src/components/seo/absolute-url";
import { categoryLastModified } from "@/src/lib/seo/category-lastmod";

// Каждую страницу отдаём ×3 локали (равновесные URL) с hreflang-alternates —
// чтобы Google индексировал ru/kk/en раздельно и связывал как равные.
function localized(
  path: string,
  extra: Omit<MetadataRoute.Sitemap[number], "url" | "alternates">,
): MetadataRoute.Sitemap {
  const clean = path === "/" ? "" : path;
  const languages = Object.fromEntries(
    LOCALES.map((l) => [HREFLANG[l], `${SITE_URL}/${l}${clean}`]),
  );
  return LOCALES.map((l) => ({
    url: `${SITE_URL}/${l}${clean}`,
    ...extra,
    alternates: { languages },
  }));
}

// Дата последнего СМЫСЛОВОГО изменения статической страницы.
//
// Список ручной намеренно. Брать mtime файла нельзя: git время изменения не
// хранит, после чистого клона на сервере mtime станет датой выкатки — и lastmod
// начнёт прыгать при каждом деплое, хотя текст страницы не менялся. Прыгающий
// lastmod хуже отсутствующего: поисковик перестаёт верить полю и игнорирует его
// на всём сайте.
//
// ПРАВИЛО ПРАВКИ: дату двигаем, когда изменился СМЫСЛ страницы (условия, цены,
// реквизиты, новый раздел текста). Опечатка, вёрстка, перестановка блоков —
// не повод. Забыли обновить — не страшно; обновили без причины — хуже.
//
// Добавили в карту новый статический маршрут — заведите ему дату здесь же:
// src/lib/seo/sitemap-lastmod.test.ts на это ругается.
const STATIC_LAST_MODIFIED: Record<string, string> = {
  "/": "2026-09-18",
  "/catalog": "2026-09-18",
  "/optom": "2026-09-18",
  "/oplata-i-dostavka": "2026-09-18",
  "/contacts": "2026-09-18",
  "/oferta": "2026-09-18",
  "/privacy": "2026-09-18",
};

/** Статическая страница карты: та же локализация плюс дата из таблицы выше. */
function staticPage(
  path: string,
  extra: Omit<MetadataRoute.Sitemap[number], "url" | "alternates" | "lastModified">,
): MetadataRoute.Sitemap {
  const lastModified = STATIC_LAST_MODIFIED[path];

  // Даты нет в таблице — поле опускаем целиком. Выдуманная дата хуже никакой.
  return localized(path, { ...(lastModified ? { lastModified } : {}), ...extra });
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  // Берём полные объекты (а не только slug) — нужны updated_at и фото для обогащения карты.
  const [categories, products] = await Promise.all([fetchCategories(), fetchProducts()]);

  const staticPages: MetadataRoute.Sitemap = [
    ...staticPage("/", { changeFrequency: "weekly", priority: 1 }),
    ...staticPage("/catalog", { changeFrequency: "daily", priority: 0.9 }),
    ...staticPage("/optom", { changeFrequency: "monthly", priority: 0.7 }),
    ...staticPage("/oplata-i-dostavka", { changeFrequency: "monthly", priority: 0.5 }),
    ...staticPage("/contacts", { changeFrequency: "monthly", priority: 0.5 }),
    ...staticPage("/oferta", { changeFrequency: "yearly", priority: 0.3 }),
    ...staticPage("/privacy", { changeFrequency: "yearly", priority: 0.3 }),
  ];

  const newestInCategory = categoryLastModified(products);

  const categoryPages: MetadataRoute.Sitemap = categories.flatMap((category) => {
    // Ни у одного товара раздела нет updated_at — поле не ставим вовсе.
    const lastModified = newestInCategory.get(category.id);

    return localized(`/catalog/${category.slug}`, {
      ...(lastModified ? { lastModified } : {}),
      changeFrequency: "weekly",
      priority: 0.7,
    });
  });

  const productPages: MetadataRoute.Sitemap = products.flatMap((product) => {
    const imageUrl = toAbsoluteUrl(product.images?.[0]);

    return localized(`/product/${product.slug}`, {
      // lastModified только при реальном updated_at — дату не выдумываем (без Date.now).
      ...(product.updated_at ? { lastModified: product.updated_at } : {}),
      // Фото товара абсолютным URL — для image-расширения карты сайта.
      ...(imageUrl ? { images: [imageUrl] } : {}),
      changeFrequency: "weekly",
      priority: 0.6,
    });
  });

  return [...staticPages, ...categoryPages, ...productPages];
}
