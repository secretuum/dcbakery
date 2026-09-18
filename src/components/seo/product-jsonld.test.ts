import { test } from "node:test";
import assert from "node:assert/strict";
import { buildProductJsonLd } from "@/src/components/seo/product-jsonld";
import { SITE_URL } from "@/src/lib/site-url";
import type { Product } from "@/src/types";

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
