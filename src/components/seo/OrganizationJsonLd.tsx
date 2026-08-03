// Богатые структурированные данные бизнеса (Schema.org LocalBusiness) для поиска и
// рекламы: NAP (имя/адрес/телефон), часы работы, соцсети. Значения — из редактируемого
// контента сайта (getSiteContent), чтобы карточка в поиске совпадала с сайтом.

import { getSiteContent } from "@/src/lib/site-content";
import { SITE_URL } from "@/src/lib/site-url";
import { JsonLd } from "./JsonLd";

// «Пн–Пт 9:00–19:00» → «Mo-Fr 09:00-19:00» (формат Schema.org openingHours). null если не распознали.
function parseOpeningHours(workHours: string): string | null {
  const m = workHours.match(
    /(Пн|Вт|Ср|Чт|Пт|Сб|Вс)\s*[–—-]\s*(Пн|Вт|Ср|Чт|Пт|Сб|Вс)\s*(\d{1,2}):(\d{2})\s*[–—-]\s*(\d{1,2}):(\d{2})/,
  );
  if (!m) return null;
  const day: Record<string, string> = { Пн: "Mo", Вт: "Tu", Ср: "We", Чт: "Th", Пт: "Fr", Сб: "Sa", Вс: "Su" };
  const pad = (s: string) => s.padStart(2, "0");
  return `${day[m[1]]}-${day[m[2]]} ${pad(m[3])}:${m[4]}-${pad(m[5])}:${m[6]}`;
}

export async function OrganizationJsonLd() {
  const content = await getSiteContent();
  const telephone = (content.contactPhone || content.contactWhatsapp || "").replace(/\D/g, "");
  const whatsapp = (content.contactWhatsapp || "").replace(/\D/g, "");
  const street = content.address.replace(/^\s*г\.?\s*алматы\s*,?\s*/i, "").trim();
  const openingHours = parseOpeningHours(content.workHours);

  const data: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
    "@id": `${SITE_URL}/#business`,
    name: "DC Bakery",
    legalName: "ИП Кошкаров Асылбек Касымбекович",
    url: SITE_URL,
    image: `${SITE_URL}/opengraph-image`,
    logo: `${SITE_URL}/opengraph-image`,
    description:
      "B2B-поставщик десертов, полуфабрикатов и мяса для кофеен, ресторанов, магазинов и отелей. Оптовые цены, доставка по Алматы.",
    email: "info@dc-bakery.kz",
    ...(telephone ? { telephone: `+${telephone}` } : {}),
    priceRange: "₸₸",
    currenciesAccepted: "KZT",
    areaServed: { "@type": "City", name: "Алматы" },
    address: {
      "@type": "PostalAddress",
      streetAddress: street || content.address,
      addressLocality: "Алматы",
      addressRegion: "Алматы",
      addressCountry: "KZ",
    },
    sameAs: [
      "https://www.instagram.com/bakery.dc",
      ...(whatsapp ? [`https://wa.me/${whatsapp}`] : []),
    ],
    ...(openingHours ? { openingHours } : {}),
  };

  return <JsonLd data={data} />;
}
