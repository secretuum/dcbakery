import { test } from "node:test";
import assert from "node:assert/strict";
import { normalizeText, stemToken, tokenize, stemmedTokens, levenshtein } from "./normalize";

test("normalizeText: регистр, ё→е, пробелы", () => {
  assert.equal(normalizeText("  СырНИк\tёлочка  "), "сырник елочка");
  assert.equal(normalizeText("МЕДОВИК"), "медовик");
});

test("stemToken: склонения/множественное сближаются", () => {
  const a = stemToken("сырник");
  assert.equal(stemToken("сырники"), a);
  assert.equal(stemToken("сырника"), a);
  assert.equal(stemToken("сырников"), a);
});

test("stemToken: латиница транслитерируется в кириллицу", () => {
  // «kapuchino» должно сойтись с «капучино» после стемминга.
  assert.equal(stemToken("kapuchino"), stemToken("капучино"));
  assert.equal(stemToken("napoleon"), stemToken("наполеон"));
});

test("tokenize: пунктуация — разделитель", () => {
  assert.deepEqual(tokenize("3 пельмени, 4 сырника!"), ["3", "пельмени", "4", "сырника"]);
});

test("stemmedTokens: пустых нет", () => {
  const toks = stemmedTokens("2 пасты альфредо");
  assert.ok(toks.every((t) => t.length > 0));
  assert.ok(toks.includes(stemToken("пасты")));
});

test("levenshtein: базовые расстояния", () => {
  assert.equal(levenshtein("наполеон", "наполеон"), 0);
  assert.equal(levenshtein("медовик", "медовк"), 1);
  assert.equal(levenshtein("", "абв"), 3);
});
