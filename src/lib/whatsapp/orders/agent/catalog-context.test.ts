import { test } from "node:test";
import assert from "node:assert/strict";
import type { Product } from "@/src/types";
import { buildCatalogContext, catalogProductIds } from "./catalog-context";

function product(id: string, name: string, price: number, stock: number, sub: string): Product {
  return {
    id, name, slug: id, description: "", category_id: "c", price, unit: "шт",
    min_qty: 1, step_qty: 1, stock_qty: stock, images: [], is_active: true, sort_order: 0, subcategory: sub,
    weightLabel: "125 грамм",
  };
}

const CATALOG: Product[] = [
  product("medovik", "Медовик", 830, 10, "Десерты"),
  product("napoleon", "Наполеон", 2500, 0, "Десерты"),
  product("manty", "Манты", 2060, 5, "Полуфабрикаты"),
];

test("buildCatalogContext: id, цена, остаток, фасовка, группировка", () => {
  const ctx = buildCatalogContext(CATALOG);
  assert.match(ctx, /### Десерты/);
  assert.match(ctx, /### Полуфабрикаты/);
  assert.match(ctx, /id=medovik/);
  assert.match(ctx, /830 ₸/);
  assert.match(ctx, /в наличии 10/);
  assert.match(ctx, /нет в наличии/); // наполеон
  assert.match(ctx, /125 грамм/); // фасовка
});

test("catalogProductIds: множество id", () => {
  const ids = catalogProductIds(CATALOG);
  assert.ok(ids.has("medovik"));
  assert.ok(ids.has("manty"));
  assert.equal(ids.has("нет-такого"), false);
});
