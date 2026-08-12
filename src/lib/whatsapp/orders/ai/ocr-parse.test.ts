import { test } from "node:test";
import assert from "node:assert/strict";
import { extractOcrText } from "./ocr-parse";

test("extractOcrText: один JSON → fullText", () => {
  const body = JSON.stringify({ result: { textAnnotation: { fullText: "2 медовика\n1 наполеон" } } });
  assert.equal(extractOcrText(body), "2 медовика\n1 наполеон");
});

test("extractOcrText: несколько страниц (по строке на JSON) склеиваются", () => {
  const body = [
    JSON.stringify({ result: { textAnnotation: { fullText: "страница 1" } } }),
    JSON.stringify({ result: { textAnnotation: { fullText: "страница 2" } } }),
  ].join("\n");
  assert.equal(extractOcrText(body), "страница 1\nстраница 2");
});

test("extractOcrText: мусор/пусто → пустая строка", () => {
  assert.equal(extractOcrText(""), "");
  assert.equal(extractOcrText("не json"), "");
  assert.equal(extractOcrText("{}"), "");
  assert.equal(extractOcrText(JSON.stringify({ result: {} })), "");
});
