import type { MetadataRoute } from "next";
import { fetchCategories, fetchProducts } from "@/src/lib/catalog";
import { SITE_URL } from "@/src/lib/site-url";

// Относительный путь картинки → абсолютный URL (Google требует полные URL в <image:loc>).
function toAbsoluteImageUrl(image: string): string {
  return image.startsWith("http") ? image : `${SITE_URL}${image}`;
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  // Берём полные объекты (а не только slug) — нужны updated_at и фото для обогащения карты.
  const [categories, products] = await Promise.all([fetchCategories(), fetchProducts()]);

  const staticPages: MetadataRoute.Sitemap = [
    { url: `${SITE_URL}/`, changeFrequency: "weekly", priority: 1 },
    { url: `${SITE_URL}/catalog`, changeFrequency: "daily", priority: 0.9 },
    { url: `${SITE_URL}/oplata-i-dostavka`, changeFrequency: "monthly", priority: 0.5 },
    { url: `${SITE_URL}/contacts`, changeFrequency: "monthly", priority: 0.5 },
    { url: `${SITE_URL}/oferta`, changeFrequency: "yearly", priority: 0.3 },
    { url: `${SITE_URL}/privacy`, changeFrequency: "yearly", priority: 0.3 },
  ];

  const categoryPages: MetadataRoute.Sitemap = categories.map((category) => ({
    url: `${SITE_URL}/catalog/${category.slug}`,
    // lastModified только при реальном updated_at — дату не выдумываем.
    ...(category.updated_at ? { lastModified: category.updated_at } : {}),
    changeFrequency: "weekly",
    priority: 0.7,
  }));

  const productPages: MetadataRoute.Sitemap = products.map((product) => {
    const image = product.images?.[0];

    return {
      url: `${SITE_URL}/product/${product.slug}`,
      // lastModified только при реальном updated_at — дату не выдумываем (без Date.now).
      ...(product.updated_at ? { lastModified: product.updated_at } : {}),
      // Фото товара абсолютным URL — для image-расширения карты сайта.
      ...(image ? { images: [toAbsoluteImageUrl(image)] } : {}),
      changeFrequency: "weekly",
      priority: 0.6,
    };
  });

  return [...staticPages, ...categoryPages, ...productPages];
}
