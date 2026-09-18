// Schema.org Product для карточки товара. Было: name/description/brand, одна картинка
// и Offer. Добавлено то, чего поиску и товарным площадкам не хватало: артикул, ВСЕ
// фото абсолютными адресами, вес и срок действия акционной цены.
//
// Чего здесь намеренно НЕТ:
//  - aggregateRating/review — отзывов на сайте нет, размечать нечего;
//  - hasMerchantReturnPolicy и shippingDetails — это условия возврата и доставки,
//    то есть бизнес-условие. Разметка обязана повторять их слово в слово, иначе
//    площадка покажет клиенту не то, что написано в оферте. Добавлять их можно
//    только с готовым текстом от владельца, не выдумывая.

import type { Product } from "@/src/types";
import { toAbsoluteUrl } from "./absolute-url";
import { SITE_URL } from "@/src/lib/site-url";

export function buildProductJsonLd({
  product,
  name,
  description,
  categoryName,
  url,
  priceValidUntil,
}: {
  product: Product;
  /** Название в языке страницы. */
  name: string;
  /** Описание в языке страницы (с запасным текстом, если своего нет). */
  description: string;
  categoryName?: string;
  /** Абсолютный адрес карточки в её локали. */
  url: string;
  /** Последний день действия цены — только реальная дата акции, не выдуманная. */
  priceValidUntil?: string | null;
}): Record<string, unknown> {
  const images = (product.images ?? [])
    .map((image) => toAbsoluteUrl(image))
    .filter((image): image is string => Boolean(image));

  return {
    "@context": "https://schema.org",
    "@type": "Product",
    name,
    description,
    url,
    // Артикула отдельным полем в каталоге нет, а sku обязан быть стабильным и
    // публичным: slug ровно такой — он же в адресе карточки и не меняется при
    // переименовании товара в админке.
    sku: product.slug,
    brand: { "@type": "Brand", name: "DC Bakery" },
    ...(images.length ? { image: images } : {}),
    ...(categoryName ? { category: categoryName } : {}),
    // Вес отдаём числом в граммах: строковая фасовка («3 шт по 400 грамм») для
    // QuantitativeValue не годится, а weightGrams — уже нормализованное число.
    ...(product.weightGrams
      ? { weight: { "@type": "QuantitativeValue", value: product.weightGrams, unitCode: "GRM" } }
      : {}),
    ...(product.price > 0
      ? {
          offers: {
            "@type": "Offer",
            priceCurrency: "KZT",
            price: product.price,
            // Наличие из реального остатка, а не константой.
            availability:
              product.stock_qty > 0
                ? "https://schema.org/InStock"
                : "https://schema.org/OutOfStock",
            itemCondition: "https://schema.org/NewCondition",
            url,
            ...(priceValidUntil ? { priceValidUntil } : {}),
            seller: { "@type": "Organization", name: "DC Bakery", url: SITE_URL },
          },
        }
      : {}),
  };
}
