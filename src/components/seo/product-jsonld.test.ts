import { test } from "node:test";
import assert from "node:assert/strict";
import { buildProductJsonLd } from "@/src/components/seo/product-jsonld";
import { SITE_URL } from "@/src/lib/site-url";
import type { Product } from "@/src/types";
import { MIN_ORDER_AMOUNT } from "@/app/constants";

const URL_RU = `${SITE_URL}/ru/product/pelmeni-s-govyadinoy`;

function product(patch: Partial<Product> = {}): Product {
  return {
    id: "p-1",
    name: "Пельмени с говядиной",
    slug: "pelmeni-s-govyadinoy",
    description: "Ручная лепка.",
    category_id: "cat-semi",
    price: 2500,
    unit: "шт",
    min_qty: 1,
    step_qty: 1,
    stock_qty: 40,
    images: ["/products/pelmeni-s-govyadinoy.webp"],
    is_active: true,
    sort_order: 1,
    ...patch,
  };
}

function build(patch: Partial<Product> = {}, priceValidUntil?: string | null) {
  return buildProductJsonLd({
    product: product(patch),
    name: "Пельмени с говядиной",
    description: "Ручная лепка.",
    categoryName: "Полуфабрикаты",
    url: URL_RU,
    priceValidUntil,
  });
}

test("артикул берётся из slug — он публичный и совпадает с адресом карточки", () => {
  assert.equal(build().sku, "pelmeni-s-govyadinoy");
  assert.ok(URL_RU.endsWith(String(build().sku)));
});

test("все фото уходят абсолютными адресами, фото из админки не склеивается с доменом", () => {
  const supabase = "https://vdydhptmfhnrjrtqxktw.supabase.co/storage/v1/object/public/a.webp";
  const data = build({ images: ["/products/a.webp", supabase] });

  assert.deepEqual(data.image, [`${SITE_URL}/products/a.webp`, supabase]);
  for (const image of data.image as string[]) {
    assert.ok(!new globalThis.URL(image).host.includes("https"), `битый host: ${image}`);
  }
});

test("товар без фото просто не получает поле image", () => {
  assert.equal("image" in build({ images: [] }), false);
  // Пустые строки в списке фото не превращаются в ссылку на корень сайта.
  assert.equal("image" in build({ images: ["", "   "] }), false);
});

test("наличие считается из реального остатка", () => {
  assert.equal(
    (build({ stock_qty: 40 }).offers as Record<string, unknown>).availability,
    "https://schema.org/InStock",
  );
  assert.equal(
    (build({ stock_qty: 0 }).offers as Record<string, unknown>).availability,
    "https://schema.org/OutOfStock",
  );
});

test("без цены Offer не выдумывается", () => {
  assert.equal("offers" in build({ price: 0 }), false);
});

test("срок действия цены ставится только при реальной дате акции", () => {
  const withPromo = build({}, "2026-09-30").offers as Record<string, unknown>;
  const withoutPromo = build({}, null).offers as Record<string, unknown>;

  assert.equal(withPromo.priceValidUntil, "2026-09-30");
  assert.equal("priceValidUntil" in withoutPromo, false);
  assert.equal("priceValidUntil" in (build().offers as Record<string, unknown>), false);
});

test("вес отдаётся числом в граммах, строковая фасовка в разметку не попадает", () => {
  const withWeight = build({ weightGrams: 800, weightLabel: "2 шт по 400 грамм" });

  assert.deepEqual(withWeight.weight, { "@type": "QuantitativeValue", value: 800, unitCode: "GRM" });
  assert.equal("weight" in build({ weightGrams: undefined }), false);
  assert.ok(!JSON.stringify(withWeight).includes("2 шт по 400"));
});

test("обязательный минимум карточки на месте", () => {
  const data = build();
  const offers = data.offers as Record<string, unknown>;

  assert.equal(data["@type"], "Product");
  assert.equal(data.name, "Пельмени с говядиной");
  assert.equal(data.description, "Ручная лепка.");
  assert.equal(data.url, URL_RU);
  assert.deepEqual(data.brand, { "@type": "Brand", name: "DC Bakery" });
  assert.equal(offers.priceCurrency, "KZT");
  assert.equal(offers.price, 2500);
  assert.equal(offers.url, URL_RU);
});

// --- Условия доставки и возврата (перенос из оферты) -------------------------
// Всё, что ниже, сверяется с app/[locale]/(main)/oferta/page.tsx, пп. 7.1–7.3 и
// 9.1–9.4. Если тест упал — сначала смотрим в оферту, а не правим ожидание.

function offersOf(patch: Partial<Product> = {}) {
  return build(patch).offers as Record<string, unknown>;
}

function shippingOf(patch: Partial<Product> = {}) {
  return offersOf(patch).shippingDetails as Record<string, unknown>;
}

function returnPolicyOf(patch: Partial<Product> = {}) {
  return offersOf(patch).hasMerchantReturnPolicy as Record<string, unknown>;
}

/** Все ключи разметки на любой глубине — для проверок «поля нет вообще». */
function allKeys(value: unknown, acc: string[] = []): string[] {
  if (Array.isArray(value)) {
    for (const item of value) allKeys(item, acc);
  } else if (value && typeof value === "object") {
    for (const [key, nested] of Object.entries(value)) {
      acc.push(key);
      allKeys(nested, acc);
    }
  }
  return acc;
}

test("доставка по Алматы бесплатная и в тенге — п. 7.2 оферты", () => {
  assert.deepEqual(shippingOf().shippingRate, {
    "@type": "MonetaryAmount",
    value: 0,
    currency: "KZT",
  });
});

test("бесплатная доставка обещана городу, а не всему Казахстану", () => {
  const destination = shippingOf().shippingDestination as Record<string, unknown>;

  assert.equal(destination["@type"], "DefinedRegion");
  assert.equal(destination.addressCountry, "KZ");
  // KZ-75 — город Алматы по действующей редакции ISO 3166-2:KZ. Буквенный KZ-ALA
  // снят вместе со старой редакцией: если он вернётся при правке — падаем здесь.
  assert.equal(destination.addressRegion, "KZ-75");
  assert.ok(!JSON.stringify(destination).includes("KZ-ALA"));
  // Страна без региона читалась бы как бесплатная доставка по всей стране.
  assert.ok("addressRegion" in destination);
});

test("минимальная сумма заказа берётся из констант, а не из головы", () => {
  assert.deepEqual(offersOf().eligibleTransactionVolume, {
    "@type": "PriceSpecification",
    priceCurrency: "KZT",
    minPrice: MIN_ORDER_AMOUNT,
  });
  assert.equal(MIN_ORDER_AMOUNT, 15000);
});

test("возврат не допускается — п. 9.1 оферты, а не окно возврата на N дней", () => {
  const policy = returnPolicyOf();

  assert.equal(policy["@type"], "MerchantReturnPolicy");
  assert.equal(policy.returnPolicyCategory, "https://schema.org/MerchantReturnNotPermitted");
  assert.equal(policy.applicableCountry, "KZ");
  // Ни одной категории, которая обещала бы приём возвратов.
  const serialized = JSON.stringify(policy);
  for (const forbidden of [
    "MerchantReturnFiniteReturnWindow",
    "MerchantReturnUnlimitedWindow",
    "MerchantReturnUnspecified",
  ]) {
    assert.ok(!serialized.includes(forbidden), `в разметке возврата появилось ${forbidden}`);
  }
});

test("ссылка на возврат ведёт на оферту в языке карточки", () => {
  const ru = buildProductJsonLd({
    product: product(),
    name: "Пельмени",
    description: "Ручная лепка.",
    url: `${SITE_URL}/ru/product/pelmeni-s-govyadinoy`,
  }).offers as Record<string, unknown>;
  const kk = buildProductJsonLd({
    product: product(),
    name: "Пельмени",
    description: "Ручная лепка.",
    url: `${SITE_URL}/kk/product/pelmeni-s-govyadinoy`,
  }).offers as Record<string, unknown>;

  assert.equal(
    (ru.hasMerchantReturnPolicy as Record<string, unknown>).merchantReturnLink,
    `${SITE_URL}/ru/oferta`,
  );
  assert.equal(
    (kk.hasMerchantReturnPolicy as Record<string, unknown>).merchantReturnLink,
    `${SITE_URL}/kk/oferta`,
  );
});

test("сроки, которых нет в оферте, не появляются даже пустыми", () => {
  const keys = allKeys(build());

  // пп. 7.1 и 7.3: срок «согласовывается при подтверждении Заказа» — числа нет.
  // п. 9.2: три исхода по согласованию, выбрать один нельзя.
  // п. 9.4: 10 рабочих дней — срок перечисления денег, а не окно возврата.
  for (const absent of [
    "handlingTime",
    "transitTime",
    "deliveryTime",
    "businessDays",
    "cutoffTime",
    "merchantReturnDays",
    "returnMethod",
    "returnFees",
    "refundType",
    "returnShippingFeesAmount",
  ]) {
    assert.ok(!keys.includes(absent), `поле ${absent} выдумано: в оферте его нет`);
  }
});

test("в разметке нет пустых значений — поле либо с данными, либо отсутствует", () => {
  function assertNoBlanks(value: unknown, path: string): void {
    if (value === null || value === undefined) {
      assert.fail(`${path}: пустое значение вместо отсутствующего поля`);
    }
    if (typeof value === "string") {
      assert.notEqual(value.trim(), "", `${path}: пустая строка`);
      return;
    }
    if (Array.isArray(value)) {
      assert.notEqual(value.length, 0, `${path}: пустой список`);
      value.forEach((item, i) => assertNoBlanks(item, `${path}[${i}]`));
      return;
    }
    if (typeof value === "object") {
      const entries = Object.entries(value);
      assert.notEqual(entries.length, 0, `${path}: пустой объект`);
      for (const [key, nested] of entries) assertNoBlanks(nested, `${path}.${key}`);
    }
  }

  // Товар без фото, без веса, без акции и без категории — самый «дырявый» случай.
  assertNoBlanks(
    buildProductJsonLd({
      product: product({ images: [], weightGrams: undefined }),
      name: "Пельмени",
      description: "Ручная лепка.",
      url: URL_RU,
      priceValidUntil: null,
    }),
    "product",
  );
  assertNoBlanks(build(), "product");
});

test("условия доставки и возврата исчезают вместе с Offer, если цены нет", () => {
  const keys = allKeys(build({ price: 0 }));

  assert.ok(!keys.includes("shippingDetails"));
  assert.ok(!keys.includes("hasMerchantReturnPolicy"));
  assert.ok(!keys.includes("eligibleTransactionVolume"));
});
