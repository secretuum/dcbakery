// Богатые структурированные данные бизнеса (Schema.org LocalBusiness) для поиска и
// рекламы: NAP (имя/адрес/телефон), часы работы, соцсети. Значения — из редактируемого
// контента сайта (getSiteContent), чтобы карточка в поиске совпадала с сайтом.

import { fetchCategories } from "@/src/lib/catalog";
import { LOCALES } from "@/src/i18n/config";
import { getT } from "@/src/i18n/server";
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
  const [content, t] = await Promise.all([getSiteContent(), getT()]);
  const telephone = (content.contactPhone || content.contactWhatsapp || "").replace(/\D/g, "");
  const whatsapp = (content.contactWhatsapp || "").replace(/\D/g, "");
  // Адрес и часы работы приходят из site_content и всегда РУССКИЕ (админка одна),
  // parseOpeningHours ниже разбирает именно русские сокращения дней. Ни адрес, ни
  // город тут НЕ переводим намеренно: карточка в поиске должна совпадать с Google
  // Business Profile и 2GIS символ-в-символ — это и есть «единый NAP». Переводим
  // только прозу (описание, каталог, темы), она на совпадение NAP не влияет.
  const street = content.address.replace(/^\s*г\.?\s*алматы\s*,?\s*/i, "").trim();
  const openingHours = parseOpeningHours(content.workHours);

  // Реальные активные линейки товара (env-гейтед категории сюда не попадут) —
  // используем и в hasOfferCatalog, и в knowsAbout, чтобы не расходились с витриной.
  // Названия категорий каталог отдаёт русскими — переводим по словарю, ровно как
  // это делают фильтры каталога и плитки на главной.
  const categories = await fetchCategories();
  const productLines = categories.map((category) => t(category.name));

  const data: Record<string, unknown> = {
    "@context": "https://schema.org",
    // Уточняем тип: пекарня + оптовый продуктовый поставщик. @type-массив, чтобы
    // сохранить сигналы LocalBusiness/FoodEstablishment и добавить Bakery.
    "@type": ["LocalBusiness", "Bakery", "FoodEstablishment"],
    additionalType: "https://schema.org/FoodEstablishment",
    "@id": `${SITE_URL}/#business`,
    name: "DC Bakery",
    legalName: "ИП Кошкаров Асылбек Касымбекович",
    url: SITE_URL,
    // Брендовая OG-картинка для превью и квадратный логотип для карточки в поиске.
    image: `${SITE_URL}/brand/og-cover.png`,
    logo: `${SITE_URL}/brand/dc-bakery_logo_1.png`,
    description: t(
      "B2B-поставщик десертов, полуфабрикатов и мяса для кофеен, ресторанов, магазинов и отелей. Оптовые цены, доставка по Алматы.",
    ),
    email: "info@dc-bakery.kz",
    // Языки обслуживания — сигнал для поиска и ИИ-ассистентов, что с поставщиком
    // можно вести переписку и заказ на любом из этих языков.
    knowsLanguage: [...LOCALES],
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
      // TODO(владелец): geo-координаты (широта/долгота) НЕ добавлены намеренно —
      // решение по точным координатам склада/производства пока не принято.
    },
    sameAs: [
      "https://www.instagram.com/bakery.dc",
      ...(whatsapp ? [`https://wa.me/${whatsapp}`] : []),
    ],
    ...(openingHours ? { openingHours } : {}),
    // Каталог предложений по активным линейкам — сигнал ассортимента для поиска/ИИ.
    hasOfferCatalog: {
      "@type": "OfferCatalog",
      name: t("Оптовый каталог DC Bakery"),
      itemListElement: productLines.map((line) => ({
        "@type": "OfferCatalog",
        name: line,
      })),
    },
    // Тематические сущности: линейки товара + оптовый B2B и HoReCa.
    // «HoReCa» — международный термин, в казахском и английском тот же, не переводим.
    knowsAbout: [...productLines, t("оптовые поставки B2B"), "HoReCa"],
  };

  return <JsonLd data={data} />;
}
