import { strict as assert } from "node:assert";
import { test } from "node:test";
import { categoryLastModified } from "./category-lastmod";

test("берётся самая свежая дата среди товаров раздела", () => {
  const result = categoryLastModified([
    { category_id: "cat-desserts", updated_at: "2026-09-10T10:00:00Z" },
    { category_id: "cat-desserts", updated_at: "2026-09-17T08:00:00Z" },
    { category_id: "cat-desserts", updated_at: "2026-09-02T23:00:00Z" },
  ]);

  assert.equal(result.get("cat-desserts"), "2026-09-17T08:00:00Z");
});

test("разделы не смешиваются между собой", () => {
  const result = categoryLastModified([
    { category_id: "cat-desserts", updated_at: "2026-09-17T08:00:00Z" },
    { category_id: "cat-meat", updated_at: "2026-09-01T08:00:00Z" },
  ]);

  assert.equal(result.get("cat-desserts"), "2026-09-17T08:00:00Z");
  assert.equal(result.get("cat-meat"), "2026-09-01T08:00:00Z");
});

test("раздел без единой даты в карту не попадает", () => {
  // Пустое или выдуманное значение хуже, чем отсутствие поля: вызывающий
  // по undefined опускает lastModified целиком.
  const result = categoryLastModified([
    { category_id: "cat-meat" },
    { category_id: "cat-meat", updated_at: undefined },
  ]);

  assert.equal(result.has("cat-meat"), false);
  assert.equal(result.get("cat-meat"), undefined);
});

test("мусор в updated_at не роняет карту и не побеждает настоящую дату", () => {
  const result = categoryLastModified([
    { category_id: "cat-meat", updated_at: "не дата" },
    { category_id: "cat-meat", updated_at: "2026-09-05T08:00:00Z" },
    { category_id: "cat-meat", updated_at: "" },
  ]);

  assert.equal(result.get("cat-meat"), "2026-09-05T08:00:00Z");
});

test("сравниваются моменты времени, а не строки (разные смещения)", () => {
  // Лексикографически "2026-09-18T00:00:00+06:00" больше "2026-09-18T01:00:00Z",
  // но на самом деле это 17-е число 18:00 UTC — то есть РАНЬШЕ.
  const result = categoryLastModified([
    { category_id: "cat-desserts", updated_at: "2026-09-18T01:00:00Z" },
    { category_id: "cat-desserts", updated_at: "2026-09-18T00:00:00+06:00" },
  ]);

  assert.equal(result.get("cat-desserts"), "2026-09-18T01:00:00Z");
});

test("порядок товаров на результат не влияет", () => {
  const products = [
    { category_id: "cat-desserts", updated_at: "2026-09-02T10:00:00Z" },
    { category_id: "cat-desserts", updated_at: "2026-09-17T10:00:00Z" },
  ];

  const forward = categoryLastModified(products);
  const backward = categoryLastModified([...products].reverse());

  assert.equal(forward.get("cat-desserts"), backward.get("cat-desserts"));
});

test("пустой каталог даёт пустую карту, а не падение", () => {
  assert.equal(categoryLastModified([]).size, 0);
});
