// Schema.org Product для карточки товара. Было: name/description/brand, одна картинка
// и Offer. Добавлено то, чего поиску и товарным площадкам не хватало: артикул, ВСЕ
// фото абсолютными адресами, вес и срок действия акционной цены.
//
// Условия доставки и возврата (shippingDetails/hasMerchantReturnPolicy) перенесены
// из оферты — app/[locale]/(main)/oferta/page.tsx, пункты 7.1–7.3 и 9.1–9.4.
// Разметка обязана ПОВТОРЯТЬ оферту, а не пересказывать её: ни одного числа и ни
// одного обещания, которого нет в тексте договора, здесь быть не должно. Оферта —
// единственный источник; меняется она — меняется и этот файл, и только в эту сторону.
//
// Чего здесь намеренно НЕТ — каждое поле пропущено потому, что честного значения
// для него в оферте не существует, а ложная разметка хуже отсутствующей:
//  - aggregateRating/review — отзывов на сайте нет, размечать нечего;
//  - handlingTime/transitTime — пп. 7.1 и 7.3: способ получения и сроки
//    «согласовываются Сторонами при подтверждении Заказа». Числа нет ни в договоре,
//    ни в коде. Ноль или «1–3 дня» — это обязательство, которого мы не брали;
//  - deliveryTime.businessDays/cutoffTime — расписание поставок (вт/чт/сб, отсечка
//    18:00) живёт в src/lib/site-content.ts и правится владельцем через админку.
//    Взять его сюда нечем: модуль серверный (import "server-only", next/cache,
//    supabase), а эта функция чистая и покрыта юнит-тестом. Скопировать числа
//    константой — значит завести второй источник правды, который тихо разойдётся
//    с админкой: владелец поменяет расписание, витрина покажет новое, а разметка
//    останется на дефолте. Разметка, расходящаяся с видимым содержимым страницы,
//    наказывается сильнее, чем её отсутствие. К тому же и оферта недельного
//    графика не обещает — п. 7.1 отдаёт сроки на согласование при заказе;
//  - merchantReturnDays/returnMethod/returnFees — это реквизиты окна возврата,
//    а окна возврата у нас нет вовсе (см. комментарий к returnPolicyCategory);
//  - refundType — п. 9.2 даёт ТРИ исхода: «замену Продукции, допоставку либо
//    возврат её стоимости», и только «по согласованию с Покупателем». Выбрать один
//    в разметку — соврать про два остальных;
//  - срок из п. 9.4 (до 10 рабочих дней по карте) — это срок ПЕРЕЧИСЛЕНИЯ денег
//    после согласования, а не срок, в который принимают возврат. В merchantReturnDays
//    он прочитался бы как «10 дней на возврат» — прямое противоречие п. 9.1.

import type { Product } from "@/src/types";
import { toAbsoluteUrl } from "./absolute-url";
import { SITE_URL } from "@/src/lib/site-url";
import { stripLocale } from "@/src/i18n/routing";
import { MIN_ORDER_AMOUNT, deliveryFee } from "@/app/constants";

/** Абсолютный адрес оферты в языке карточки — полный текст условий, а не пересказ. */
function ofertaUrl(productUrl: string): string {
  let pathname = productUrl;
  try {
    pathname = new URL(productUrl).pathname;
  } catch {
    // Адрес пришёл относительным — stripLocale разберёт его как путь и сам
    // отдаст локаль по умолчанию, если префикса нет.
  }
  return `${SITE_URL}/${stripLocale(pathname).locale}/oferta`;
}

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
            // п. 7.2: «Минимальная сумма одного Заказа составляет 15 000 … тенге».
            // Это условие сделки, а не подсказка интерфейса: заказ дешевле не
            // оформляется вовсе, поэтому ему место в разметке предложения.
            eligibleTransactionVolume: {
              "@type": "PriceSpecification",
              priceCurrency: "KZT",
              minPrice: MIN_ORDER_AMOUNT,
            },
            shippingDetails: {
              "@type": "OfferShippingDetails",
              // п. 7.2: «Доставка Продукции по городу Алматы осуществляется
              // Поставщиком бесплатно на все Заказы». Ноль берём вызовом
              // deliveryFee(), а не литералом: вернутся платные тарифы — разметка
              // поедет за кодом, а не останется врать про бесплатность.
              shippingRate: {
                "@type": "MonetaryAmount",
                value: deliveryFee(),
                currency: "KZT",
              },
              // Регион сужаем до города намеренно. Оферта обещает бесплатную
              // доставку по Алматы, а не по Казахстану: один addressCountry "KZ"
              // прочитался бы как бесплатная доставка по всей стране — то есть
              // разметка пообещала бы больше договора.
              //
              // KZ-75 — код города Алматы по ДЕЙСТВУЮЩЕЙ редакции ISO 3166-2:KZ
              // (двузначные цифровые коды; у Алматинской области свой — KZ-19).
              // Буквенный KZ-ALA из прежней редакции снят, ставить его нельзя.
              //
              // Альтернатива — задать город диапазоном почтовых индексов через
              // postalCodeRange. Не берём: точные границы диапазона по Алматы мы
              // не подтвердили, а выдуманные числа здесь ровно то, чего этот файл
              // старается избежать. Код субъекта проверяем по стандарту.
              shippingDestination: {
                "@type": "DefinedRegion",
                addressCountry: "KZ",
                addressRegion: "KZ-75",
              },
            },
            hasMerchantReturnPolicy: {
              "@type": "MerchantReturnPolicy",
              // п. 9.1: «Возврат Продукции не допускается, за исключением случаев
              // производственного брака, подтверждённого Поставщиком».
              //
              // returnPolicyCategory в schema.org описывает окно возврата товара
              // НАДЛЕЖАЩЕГО качества — случай «клиент передумал». Такого окна у нас
              // нет ни одного дня, поэтому MerchantReturnNotPermitted.
              //
              // Оговорка про брак этой категорией не выражается и не должна: замена
              // бракованной Продукции по пп. 9.1–9.2 — не возврат по желанию
              // покупателя, а гарантийное обязательство Поставщика. Подставить сюда
              // MerchantReturnFiniteReturnWindow ради этой оговорки — значит обещать
              // приём возвратов, которого оферта не даёт.
              //
              // MerchantReturnUnspecified («условия не заявлены») был бы враньём в
              // другую сторону: оферта как раз высказалась, и вполне определённо.
              returnPolicyCategory: "https://schema.org/MerchantReturnNotPermitted",
              applicableCountry: "KZ",
              // Полный текст условий — в самой оферте. Ссылка здесь для того, чтобы
              // и человек, и робот читали договор, а не наш пересказ одним полем.
              merchantReturnLink: ofertaUrl(url),
            },
          },
        }
      : {}),
  };
}
