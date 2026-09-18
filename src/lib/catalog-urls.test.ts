import { test } from "node:test";
import assert from "node:assert/strict";
import { LOCALES } from "@/src/i18n/config";
import { categoryPath, productPath } from "./catalog-urls";

test("productPath: языковой префикс для каждой локали сайта", () => {
  assert.equal(productPath("tort-medovik", "ru"), "/ru/product/tort-medovik");
  assert.equal(productPath("tort-medovik", "kk"), "/kk/product/tort-medovik");
  assert.equal(productPath("tort-medovik", "en"), "/en/product/tort-medovik");
});

test("productPath: локаль есть у всех языков сайта, ни одна не теряется", () => {
  for (const locale of LOCALES) {
    assert.equal(productPath("shu-yagodnyy", locale), `/${locale}/product/shu-yagodnyy`);
  }
});

test("productPath: slug, совпадающий с кодом языка, не путается с префиксом", () => {
  // withLocale считает путь уже локализованным по ПЕРВОМУ сегменту. Здесь первый
  // сегмент — "product", так что slug "ru" остаётся slug'ом, а не префиксом.
  assert.equal(productPath("ru", "en"), "/en/product/ru");
});

test("productPath: спецсимволы в slug кодируются, ссылка не рвётся", () => {
  // Без encodeURIComponent «?» и «#» превратили бы хвост slug'а в query/hash, а
  // пробел дал бы битую ссылку. Slug приходит из прайса, там бывает что угодно.
  assert.equal(productPath("tort medovik", "ru"), "/ru/product/tort%20medovik");
  assert.equal(productPath("a?b", "ru"), "/ru/product/a%3Fb");
  assert.equal(productPath("a#b", "ru"), "/ru/product/a%23b");
});

test("categoryPath: языковой префикс для каждой локали сайта", () => {
  assert.equal(categoryPath("deserty", "ru"), "/ru/catalog/deserty");
  assert.equal(categoryPath("deserty", "kk"), "/kk/catalog/deserty");
  assert.equal(categoryPath("deserty", "en"), "/en/catalog/deserty");
});

test("categoryPath: спецсимволы в slug кодируются", () => {
  assert.equal(categoryPath("myaso i ptitsa", "ru"), "/ru/catalog/myaso%20i%20ptitsa");
});
