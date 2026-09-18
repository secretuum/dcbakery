// Общий сборщик «социальных» метаданных страницы: canonical + hreflang, Open Graph
// и Twitter-карточка.
//
// Зачем общий: метаданные в Next мержатся ПОВЕРХНОСТНО — вложенный openGraph из
// родительского layout заменяется целиком или не заменяется вовсе. Раньше страницы
// своего openGraph не задавали, и на /catalog, /optom, /contacts и разделах каталога
// в og:title/og:description уходил общесайтовый текст, а og:url указывал на КОРЕНЬ
// локали, а не на саму страницу: ссылка на раздел в WhatsApp выглядела как ссылка на
// главную. Карточка товара, наоборот, задавала свой блок и теряла alternateLocale и
// twitter-картинку. Здесь блок собирается целиком и одинаково для всех страниц.

import type { Metadata } from "next";
import { LOCALES, OG_LOCALE, type Locale } from "@/src/i18n/config";
import { buildAlternates } from "@/src/i18n/routing";
import { SITE_URL } from "@/src/lib/site-url";
import { toAbsoluteUrl } from "./absolute-url";

/** Брендовая обложка — превью для всех страниц, кроме карточки товара со своим фото. */
export const BRAND_OG_IMAGE = "/brand/og-cover.png";

type PageMetadataInput = {
  /** Путь БЕЗ языкового префикса: "/", "/catalog", "/product/medovik". */
  path: string;
  locale: Locale;
  /** og:title — без «| DC Bakery»: бренд несёт og:site_name, дублировать незачем. */
  title: string;
  description: string;
  /** Фото товара (относительное или абсолютное). Нет — берём брендовую обложку. */
  image?: string | null;
};

/** Абсолютный адрес страницы в её локали — он же og:url. */
export function pageUrl(path: string, locale: Locale): string {
  return `${SITE_URL}/${locale}${path === "/" ? "" : path}`;
}

export function buildPageMetadata({
  path,
  locale,
  title,
  description,
  image,
}: PageMetadataInput): Metadata {
  const url = pageUrl(path, locale);
  const brandImage = toAbsoluteUrl(BRAND_OG_IMAGE) as string;
  const ownImage = toAbsoluteUrl(image);

  return {
    alternates: buildAlternates(path, locale),
    openGraph: {
      type: "website",
      siteName: "DC Bakery",
      title,
      description,
      url,
      locale: OG_LOCALE[locale],
      alternateLocale: LOCALES.filter((l) => l !== locale).map((l) => OG_LOCALE[l]),
      // Размеры указываем только у брендовой обложки — они известны (1200×630).
      // У фото товара пропорции произвольные, врать про них нельзя.
      images: [
        ownImage
          ? { url: ownImage, alt: title }
          : { url: brandImage, width: 1200, height: 630, alt: "DC Bakery" },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      // Та же картинка, что в og: раньше на товаре og:image был фотографией, а
      // twitter:image оставался брендовым от layout.
      images: [ownImage ?? brandImage],
    },
  };
}
