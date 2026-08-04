import { test } from "node:test";
import assert from "node:assert/strict";
import type { Product } from "@/src/types";
import { applyOps, computeCartView, reconcileStock, type CartItemQty } from "./cart-math";

function product(id: string, price: number, stock: number, extra: Partial<Product> = {}): Product {
  return {
    id,
    name: id,
    slug: id,
    description: "",
    category_id: "c",
    price,
    unit: "шт",
    min_qty: 1,
    step_qty: 1,
    stock_qty: stock,
    images: [],
    is_active: true,
    sort_order: 0,
    ...extra,
  };
}

const P = new Map<string, Product>([
  ["medovik", product("medovik", 2000, 10)],
  ["napoleon", product("napoleon", 2500, 3)],
  ["syrniki", product("syrniki", 1500, 0)], // нет в наличии
]);

test("applyOps: add/set/remove", () => {
  let r = applyOps([], [{ productId: "medovik", qty: 2, operation: "add" }], P);
  assert.deepEqual(r.items, [{ productId: "medovik", qty: 2 }]);

  r = applyOps(r.items, [{ productId: "medovik", qty: 1, operation: "add" }], P);
  assert.equal(r.items[0].qty, 3);

  r = applyOps(r.items, [{ productId: "medovik", qty: 5, operation: "set" }], P);
  assert.equal(r.items[0].qty, 5);

  r = applyOps(r.items, [{ productId: "medovik", qty: 2, operation: "remove" }], P);
  assert.equal(r.items[0].qty, 3);

  r = applyOps(r.items, [{ productId: "medovik", qty: 10, operation: "remove" }], P);
  assert.equal(r.items.length, 0); // ушло в 0 → удалено
});

test("applyOps: клэмп по остатку", () => {
  const r = applyOps([], [{ productId: "napoleon", qty: 9, operation: "add" }], P);
  assert.equal(r.items[0].qty, 3); // остаток 3
  assert.equal(r.adjustments[0].reason, "clamped_to_stock");
  assert.equal(r.adjustments[0].available, 3);
});

test("applyOps: нет в наличии не добавляется", () => {
  const r = applyOps([], [{ productId: "syrniki", qty: 2, operation: "add" }], P);
  assert.equal(r.items.length, 0);
  assert.equal(r.adjustments[0].reason, "out_of_stock");
});

test("computeCartView: серверные цены + доставка по порогам", () => {
  // 2 медовика по 2000 = 4000 → доставка 3000 (сумма < 10000)
  const v1 = computeCartView([{ productId: "medovik", qty: 2 }], P);
  assert.equal(v1.itemsTotal, 4000);
  assert.equal(v1.delivery, 3000);
  assert.equal(v1.grandTotal, 7000);

  // 8 медовиков = 16000 → доставка бесплатна (>=15000)
  const v2 = computeCartView([{ productId: "medovik", qty: 8 }], P);
  assert.equal(v2.itemsTotal, 16000);
  assert.equal(v2.delivery, 0);
  assert.equal(v2.grandTotal, 16000);
});

test("reconcileStock: пересчёт по свежему остатку урезает", () => {
  const items: CartItemQty[] = [{ productId: "napoleon", qty: 9 }];
  const r = reconcileStock(items, P);
  assert.equal(r.items[0].qty, 3);
  assert.equal(r.adjustments.length, 1);
});
