import { test } from "node:test";
import assert from "node:assert/strict";
import type { Product } from "@/src/types";
import {
  sanitizeCatalogPromo,
  isPromoActive,
  discountPercent,
  applyCatalogPromo,
  MAX_PROMO_PRICE,
} from "./catalog-promo";

function product(over: Partial<Product> = {}): Product {
  return {
    id: "medovik",
    name: "Медовик",
    slug: "medovik",
    description: "",
    category_id: "cakes",
    price: 1000,
    unit: "шт",
    min_qty: 1,
    step_qty: 1,
    stock_qty: 10,
    images: [],
    is_active: true,
    sort_order: 0,
    ...over,
  };
}

test("sanitizeCatalogPromo: клампы и отсев мусора", () => {
  const p = sanitizeCatalogPromo({
    enabled: true,
    label: "x".repeat(500),
    activeUntil: "2026-08-31",
    prices: { medovik: 500, bad: -5, huge: MAX_PROMO_PRICE + 1, zero: 0, napoleon: "700" },
  });
  assert.equal(p.enabled, true);
  assert.equal(p.label.length, 200);
  assert.equal(p.activeUntil, "2026-08-31");
  assert.deepEqual(p.prices, { medovik: 500, napoleon: 700 }); // bad/huge/zero отсеяны, строка → число
});

test("sanitizeCatalogPromo: битая дата → null, мусор → дефолт", () => {
  assert.equal(sanitizeCatalogPromo({ activeUntil: "31.08.2026" }).activeUntil, null);
  assert.deepEqual(sanitizeCatalogPromo(null).prices, {});
  assert.equal(sanitizeCatalogPromo("nope").enabled, false);
});

test("isPromoActive: включена + не истекла + есть цены", () => {
  const base = { enabled: true, label: "", activeUntil: "2026-08-31", prices: { a: 1 } };
  assert.equal(isPromoActive(base, "2026-08-13"), true);
  assert.equal(isPromoActive(base, "2026-08-31"), true); // включительно
  assert.equal(isPromoActive(base, "2026-09-01"), false); // истекла
  assert.equal(isPromoActive({ ...base, enabled: false }, "2026-08-13"), false);
  assert.equal(isPromoActive({ ...base, prices: {} }, "2026-08-13"), false);
  assert.equal(isPromoActive({ ...base, activeUntil: null }, "2030-01-01"), true); // без истечения
  assert.equal(isPromoActive(null, "2026-08-13"), false);
});

test("discountPercent", () => {
  assert.equal(discountPercent(1000, 500), 50);
  assert.equal(discountPercent(1000, 700), 30);
  assert.equal(discountPercent(1000, 1000), 0); // не ниже
  assert.equal(discountPercent(1000, 1200), 0); // выше
  assert.equal(discountPercent(0, 0), 0);
});

test("applyCatalogPromo: выставляет oldPrice/price/isPromo только где цена ниже", () => {
  const promo = { enabled: true, label: "", activeUntil: "2026-08-31", prices: { medovik: 600, napoleon: 900 } };
  const products = [product({ id: "medovik", price: 1000 }), product({ id: "napoleon", price: 800 })];
  const result = applyCatalogPromo(products, promo, "2026-08-13");

  const medovik = result.find((p) => p.id === "medovik")!;
  assert.equal(medovik.price, 600);
  assert.equal(medovik.oldPrice, 1000);
  assert.equal(medovik.isPromo, true);

  // napoleon: промо 900 НЕ ниже базовой 800 → не трогаем
  const napoleon = result.find((p) => p.id === "napoleon")!;
  assert.equal(napoleon.price, 800);
  assert.equal(napoleon.oldPrice, undefined);
});

test("applyCatalogPromo: промо не активна → список без изменений", () => {
  const products = [product({ price: 1000 })];
  assert.equal(applyCatalogPromo(products, null, "2026-08-13")[0].price, 1000);
  const expired = { enabled: true, label: "", activeUntil: "2026-08-01", prices: { medovik: 500 } };
  assert.equal(applyCatalogPromo(products, expired, "2026-08-13")[0].price, 1000);
});
