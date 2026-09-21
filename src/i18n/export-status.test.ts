import { test } from "node:test";
import assert from "node:assert/strict";
import {
  EN_MISSING_MARK,
  STATUS_MISSING,
  STATUS_MISSING_KK,
  englishCell,
  gapOf,
  gapStatus,
  newSinceBoundary,
} from "./export-status";

const kk = { Каталог: "Каталог KK", "Собственное производство": "Өз өндірісіміз", Пусто: "  " };
const en = { Каталог: "Catalog", кг: "kg" };

test("gapOf: перевод есть в обоих словарях → пропуска нет", () => {
  assert.equal(gapOf("Каталог", kk, en), null);
});

test("gapOf: «кг» есть в en и нет в kk → казахский пропуск", () => {
  assert.equal(gapOf("кг", kk, en), "kk");
});

test("gapOf: строка есть в kk и нет в en → английский пропуск", () => {
  assert.equal(gapOf("Собственное производство", kk, en), "en");
});

test("gapOf: строки нет ни в одном словаре → оба", () => {
  assert.equal(gapOf("Новая строка", kk, en), "both");
});

test("gapOf: пустое значение считается пропуском", () => {
  assert.equal(gapOf("Пусто", kk, en), "both");
});

test("gapOf: ключи из прототипа объекта не считаются переводом", () => {
  assert.equal(gapOf("constructor", {}, {}), "both");
});

test("gapStatus: казахский пропуск — громкий отдельный статус", () => {
  assert.equal(gapStatus("kk"), STATUS_MISSING_KK);
  assert.equal(gapStatus("both"), STATUS_MISSING);
  assert.notEqual(STATUS_MISSING_KK, STATUS_MISSING);
});

test("gapStatus: английский пропуск статус не меняет", () => {
  assert.equal(gapStatus("en"), null);
  assert.equal(gapStatus(null), null);
});

test("englishCell: тихая отметка вместо пустой клетки при английском пропуске", () => {
  assert.equal(englishCell("en", ""), EN_MISSING_MARK);
  assert.equal(englishCell("both", ""), EN_MISSING_MARK);
  assert.equal(englishCell("kk", "kg"), "kg");
  assert.equal(englishCell(null, "Catalog"), "Catalog");
});

test("newSinceBoundary: «2026-09-18» → ровно полночь по Алматы, без привязки к часу запуска", () => {
  assert.equal(newSinceBoundary("2026-09-18"), "2026-09-18T00:00:00+05:00");
  assert.equal(Date.parse(newSinceBoundary("2026-09-18")), Date.UTC(2026, 8, 17, 19, 0, 0));
});

test("newSinceBoundary: не дата → ошибка, а не тихая граница «сейчас»", () => {
  assert.throws(() => newSinceBoundary("18.09.2026"));
  assert.throws(() => newSinceBoundary("2026-09-18T12:00"));
});
