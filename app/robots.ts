import type { MetadataRoute } from "next";
import { SITE_URL } from "@/src/lib/site-url";

// Закрываем от индексации служебные и приватные разделы: админку, API,
// страницы оплаты и печатные документы (счета/накладные/АВР).
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/admin", "/api/", "/pay/", "/documents/"],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
