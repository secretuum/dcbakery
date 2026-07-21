import type { MetadataRoute } from "next";
import { fetchCategorySlugs, fetchProductSlugs } from "@/src/lib/catalog";

const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://dc-bakery.kz").replace(/\/$/, "");

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [categories, products] = await Promise.all([fetchCategorySlugs(), fetchProductSlugs()]);

  const staticPages: MetadataRoute.Sitemap = [
    { url: `${SITE_URL}/`, changeFrequency: "weekly", priority: 1 },
    { url: `${SITE_URL}/catalog`, changeFrequency: "daily", priority: 0.9 },
    { url: `${SITE_URL}/oplata-i-dostavka`, changeFrequency: "monthly", priority: 0.5 },
    { url: `${SITE_URL}/contacts`, changeFrequency: "monthly", priority: 0.5 },
    { url: `${SITE_URL}/oferta`, changeFrequency: "yearly", priority: 0.3 },
    { url: `${SITE_URL}/privacy`, changeFrequency: "yearly", priority: 0.3 },
  ];

  const categoryPages: MetadataRoute.Sitemap = categories.map(({ category }) => ({
    url: `${SITE_URL}/catalog/${category}`,
    changeFrequency: "weekly",
    priority: 0.7,
  }));

  const productPages: MetadataRoute.Sitemap = products.map(({ slug }) => ({
    url: `${SITE_URL}/product/${slug}`,
    changeFrequency: "weekly",
    priority: 0.6,
  }));

  return [...staticPages, ...categoryPages, ...productPages];
}
