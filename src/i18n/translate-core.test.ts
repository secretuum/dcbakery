import { test } from "node:test";
import assert from "node:assert/strict";
import { translateWith } from "./translate-core";

test("translateWith: null словарь (ru) → оригинал", () => {
  assert.equal(translateWith(null, "Каталог"), "Каталог");
});

test("translateWith: перевод по словарю", () => {
  assert.equal(translateWith({ Каталог: "Каталог KK" }, "Каталог"), "Каталог KK");
});

test("translateWith: промах ключа → русский оригинал (фолбэк)", () => {
  assert.equal(translateWith({ Иное: "X" }, "Каталог"), "Каталог");
});

test("translateWith: схлопывание пробелов/\\n при промахе точного ключа", () => {
  assert.equal(translateWith({ "a b c": "ABC" }, "a  b\n c"), "ABC");
});

test("translateWith: подстановка ${vars} — и с словарём, и без", () => {
  assert.equal(translateWith(null, "Всего ${n}", { n: 5 }), "Всего 5");
  assert.equal(translateWith({ "Всего ${n}": "Total ${n}" }, "Всего ${n}", { n: 5 }), "Total 5");
});
