import { test } from "node:test";
import assert from "node:assert/strict";
import type { Product } from "@/src/types";
import { classifyItem, rankB2bCandidates } from "./matcher";
import { DEFAULT_RETAIL_KEYWORDS } from "./retail";

function product(id: string, name: string, extra: Partial<Product> = {}): Product {
  return {
    id,
    name,
    slug: id,
    description: "",
    category_id: "cat-desserts",
    price: 1000,
    unit: "шт",
    min_qty: 1,
    step_qty: 1,
    stock_qty: 10,
    images: [],
    is_active: true,
    sort_order: 0,
    ...extra,
  };
}

const CATALOG: Product[] = [
  product("pelmeni-govyadina", "Пельмени с говядиной", { subcategory: "Пельмени" }),
  product("syrniki", "Сырники"),
  product("medovik", "Медовик"),
  product("napoleon", "Наполеон"),
  product("vareniki-vishnya", "Вареники с вишней", { subcategory: "Вареники" }),
];

const KW = DEFAULT_RETAIL_KEYWORDS;

test("classifyItem: точное B2B-название → b2b", () => {
  const r = classifyItem("пельмени", CATALOG, KW);
  assert.equal(r.kind, "b2b");
  assert.equal(r.product?.id, "pelmeni-govyadina");
});

test("classifyItem: склонение/ед.число → b2b (сырник → Сырники)", () => {
  const r = classifyItem("сырник", CATALOG, KW);
  assert.equal(r.kind, "b2b");
  assert.equal(r.product?.id, "syrniki");
});

test("classifyItem: опечатка → b2b (наплеон → Наполеон)", () => {
  const r = classifyItem("наплеон", CATALOG, KW);
  assert.equal(r.kind, "b2b");
  assert.equal(r.product?.id, "napoleon");
});

test("classifyItem: общий корень → b2b (медовый → Медовик)", () => {
  const r = classifyItem("медовый", CATALOG, KW);
  assert.equal(r.kind, "b2b");
  assert.equal(r.product?.id, "medovik");
});

test("classifyItem: розничная позиция → retail (нет в B2B)", () => {
  const r = classifyItem("капучино", CATALOG, KW);
  assert.equal(r.kind, "retail");
  assert.ok(r.retailKeyword);
});

test("classifyItem: паста альфредо → retail", () => {
  const r = classifyItem("паста альфредо", CATALOG, KW);
  assert.equal(r.kind, "retail");
});

test("classifyItem: непонятное → unknown", () => {
  const r = classifyItem("девочки", CATALOG, KW);
  assert.equal(r.kind, "unknown");
});

test("rankB2bCandidates: до 3 ближайших для уточнения", () => {
  const cands = rankB2bCandidates("вареники", CATALOG);
  assert.ok(cands.length >= 1);
  assert.ok(cands.length <= 3);
  assert.equal(cands[0].product.id, "vareniki-vishnya");
});
