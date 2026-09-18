import { test } from "node:test";
import assert from "node:assert/strict";
import { buildItemListJsonLd } from "@/src/components/seo/item-list";

const items = [
  { name: "Медовик", url: "https://dc-bakery.kz/ru/product/tort-medovik" },
  { name: "Наполеон", url: "https://dc-bakery.kz/ru/product/tort-napoleon" },
];

test("позиции нумеруются с единицы в порядке вывода", () => {
  const data = buildItemListJsonLd({ name: "Десерты", url: "https://dc-bakery.kz/ru/catalog/deserty", items });
  const elements = data.itemListElement as { position: number; name: string; url: string }[];

  assert.equal(data["@type"], "ItemList");
  assert.equal(data.numberOfItems, 2);
  assert.deepEqual(elements.map((e) => e.position), [1, 2]);
  assert.deepEqual(elements.map((e) => e.name), ["Медовик", "Наполеон"]);
  assert.equal(elements[0].url, items[0].url);
});

test("пустой список остаётся валидным, но честно сообщает ноль позиций", () => {
  const data = buildItemListJsonLd({ name: "Мясо", url: "https://dc-bakery.kz/ru/catalog/myaso", items: [] });

  assert.equal(data.numberOfItems, 0);
  assert.deepEqual(data.itemListElement, []);
});

test("в списке нет полей, которые разъедутся с карточкой товара (цена, наличие)", () => {
  const data = buildItemListJsonLd({ name: "Десерты", url: "https://dc-bakery.kz/ru/catalog/deserty", items });
  const serialized = JSON.stringify(data);

  for (const field of ["price", "offers", "availability"]) {
    assert.ok(!serialized.includes(field), `в ItemList просочилось поле ${field}`);
  }
});
