import { test } from "node:test";
import assert from "node:assert/strict";
import type { Product } from "@/src/types";
import {
  SIMILAR_PRODUCTS_LIMIT,
  isProductInStock,
  pickSimilarProducts,
} from "./similar-products";

/** Товар-заготовка: в тестах задаём только то, что участвует в подборе. */
function makeProduct(overrides: Partial<Product> & { slug: string }): Product {
  return {
    id: overrides.slug,
    name: overrides.slug,
    description: "",
    category_id: "deserty",
    price: 1000,
    unit: "шт",
    min_qty: 1,
    step_qty: 1,
    stock_qty: 10,
    images: [],
    is_active: true,
    sort_order: 0,
    ...overrides,
  };
}

const slugs = (products: Product[]) => products.map((product) => product.slug);

test("похожие: текущий товар не попадает в свой же список", () => {
  const products = [
    makeProduct({ slug: "tort-medovik", sort_order: 1 }),
    makeProduct({ slug: "shu-yagodnyy", sort_order: 2 }),
    makeProduct({ slug: "ekler-klassicheskiy", sort_order: 3 }),
  ];

  const similar = pickSimilarProducts({ products, currentSlug: "tort-medovik" });

  assert.ok(!slugs(similar).includes("tort-medovik"), "товар не должен ссылаться сам на себя");
  assert.deepEqual(slugs(similar), ["shu-yagodnyy", "ekler-klassicheskiy"]);
});

test("похожие: отсутствующие в наличии идут последними", () => {
  const products = [
    makeProduct({ slug: "net-a", sort_order: 1, stock_qty: 0 }),
    makeProduct({ slug: "est-b", sort_order: 5, stock_qty: 7 }),
    makeProduct({ slug: "net-c", sort_order: 2, stock_qty: 0 }),
    makeProduct({ slug: "est-d", sort_order: 9, stock_qty: 3 }),
  ];

  const similar = pickSimilarProducts({ products, currentSlug: "tekushchiy" });

  // Наличие важнее sort_order: «нет в наличии» с sort_order 1 уходит вниз,
  // хотя в каталоге он стоял бы первым. Внутри каждой группы порядок каталожный.
  assert.deepEqual(slugs(similar), ["est-b", "est-d", "net-a", "net-c"]);
});

test("похожие: пустой раздел даёт пустой список", () => {
  assert.deepEqual(pickSimilarProducts({ products: [], currentSlug: "tort-medovik" }), []);
});

test("похожие: раздел из одного текущего товара тоже даёт пустой список", () => {
  const products = [makeProduct({ slug: "tort-medovik" })];

  assert.deepEqual(pickSimilarProducts({ products, currentSlug: "tort-medovik" }), []);
});

test("похожие: повторный вызов даёт тот же порядок", () => {
  const products = [
    makeProduct({ slug: "b", sort_order: 2 }),
    makeProduct({ slug: "a", sort_order: 2, stock_qty: 0 }),
    makeProduct({ slug: "c", sort_order: 1 }),
    makeProduct({ slug: "d", sort_order: 3 }),
  ];

  const first = pickSimilarProducts({ products, currentSlug: "tekushchiy" });
  const second = pickSimilarProducts({ products, currentSlug: "tekushchiy" });
  const third = pickSimilarProducts({ products, currentSlug: "tekushchiy" });

  assert.deepEqual(slugs(second), slugs(first));
  assert.deepEqual(slugs(third), slugs(first));
});

test("похожие: при равном sort_order порядок не зависит от порядка входа", () => {
  // Тай-брейк по slug. Без него порядок определялся бы тем, как товары легли в
  // каталоге, и один и тот же раздел давал бы разную перелинковку.
  const a = makeProduct({ slug: "shu", sort_order: 4 });
  const b = makeProduct({ slug: "ekler", sort_order: 4 });
  const c = makeProduct({ slug: "makaron", sort_order: 4 });

  const straight = pickSimilarProducts({ products: [a, b, c], currentSlug: "tekushchiy" });
  const reversed = pickSimilarProducts({ products: [c, b, a], currentSlug: "tekushchiy" });

  assert.deepEqual(slugs(straight), ["ekler", "makaron", "shu"]);
  assert.deepEqual(slugs(reversed), slugs(straight));
});

test("похожие: список обрезается до восьми карточек", () => {
  const products = Array.from({ length: 20 }, (_, index) =>
    makeProduct({ slug: `tovar-${index}`, sort_order: index }),
  );

  const similar = pickSimilarProducts({ products, currentSlug: "tekushchiy" });

  assert.equal(SIMILAR_PRODUCTS_LIMIT, 8);
  assert.equal(similar.length, 8);
  assert.equal(similar.length, SIMILAR_PRODUCTS_LIMIT);
  assert.deepEqual(slugs(similar).slice(0, 2), ["tovar-0", "tovar-1"]);
});

test("похожие: исходный массив не переставляется", () => {
  // Страница получает товары раздела из общего кэша каталога — портить порядок
  // чужого массива нельзя.
  const products = [
    makeProduct({ slug: "b", sort_order: 2 }),
    makeProduct({ slug: "a", sort_order: 1 }),
  ];

  pickSimilarProducts({ products, currentSlug: "tekushchiy" });

  assert.deepEqual(slugs(products), ["b", "a"]);
});

test("наличие: остатка должно хватать на минимальный заказ", () => {
  assert.equal(isProductInStock({ stock_qty: 10, min_qty: 5 }), true);
  assert.equal(isProductInStock({ stock_qty: 4, min_qty: 5 }), false);
  // min_qty 0 не делает товар с нулевым остатком «в наличии».
  assert.equal(isProductInStock({ stock_qty: 0, min_qty: 0 }), false);
  assert.equal(isProductInStock({ stock_qty: 1, min_qty: 0 }), true);
});

test("похожие: товар с нехваткой остатка на минимальный заказ уходит вниз", () => {
  const products = [
    makeProduct({ slug: "malo", sort_order: 1, stock_qty: 4, min_qty: 5 }),
    makeProduct({ slug: "hvataet", sort_order: 2, stock_qty: 5, min_qty: 5 }),
  ];

  const similar = pickSimilarProducts({ products, currentSlug: "tekushchiy" });

  assert.deepEqual(slugs(similar), ["hvataet", "malo"]);
});
