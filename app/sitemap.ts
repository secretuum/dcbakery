import type { MetadataRoute } from "next";
import { fetchCategories, fetchProducts } from "@/src/lib/catalog";
import { SITE_URL } from "@/src/lib/site-url";
import { HREFLANG, LOCALES } from "@/src/i18n/config";

// Относительный путь картинки → абсолютный URL (Google требует полные URL в <image:loc>).
function toAbsoluteImageUrl(image: string): string {
  return image.startsWith("http") ? image : `${SITE_URL}${image}`;
}

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

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  // Берём полные объекты (а не только slug) — нужны updated_at и фото для обогащения карты.
  const [categories, products] = await Promise.all([fetchCategories(), fetchProducts()]);

  const staticPages: MetadataRoute.Sitemap = [
    ...localized("/", { changeFrequency: "weekly", priority: 1 }),
    ...localized("/catalog", { changeFrequency: "daily", priority: 0.9 }),
    ...localized("/optom", { changeFrequency: "monthly", priority: 0.7 }),
    ...localized("/oplata-i-dostavka", { changeFrequency: "monthly", priority: 0.5 }),
    ...localized("/contacts", { changeFrequency: "monthly", priority: 0.5 }),
    ...localized("/oferta", { changeFrequency: "yearly", priority: 0.3 }),
    ...localized("/privacy", { changeFrequency: "yearly", priority: 0.3 }),
  ];

  const categoryPages: MetadataRoute.Sitemap = categories.flatMap((category) =>
    localized(`/catalog/${category.slug}`, {
      // lastModified только при реальном updated_at — дату не выдумываем.
      ...(category.updated_at ? { lastModified: category.updated_at } : {}),
      changeFrequency: "weekly",
      priority: 0.7,
    }),
  );

  const productPages: MetadataRoute.Sitemap = products.flatMap((product) => {
    const image = product.images?.[0];

    return localized(`/product/${product.slug}`, {
      // lastModified только при реальном updated_at — дату не выдумываем (без Date.now).
      ...(product.updated_at ? { lastModified: product.updated_at } : {}),
      // Фото товара абсолютным URL — для image-расширения карты сайта.
      ...(image ? { images: [toAbsoluteImageUrl(image)] } : {}),
      changeFrequency: "weekly",
      priority: 0.6,
    });
  });

  return [...staticPages, ...categoryPages, ...productPages];
}
