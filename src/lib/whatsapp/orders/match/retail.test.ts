import { test } from "node:test";
import assert from "node:assert/strict";
import { matchRetail, DEFAULT_RETAIL_KEYWORDS } from "./retail";

const KW = DEFAULT_RETAIL_KEYWORDS;

test("matchRetail: кафе-напитки распознаются", () => {
  assert.equal(matchRetail("капучино", KW).isRetail, true);
  assert.equal(matchRetail("2 латте", KW).isRetail, true);
  assert.equal(matchRetail("матча раф", KW).isRetail, true);
});

test("matchRetail: кухня распознаётся (паста альфредо)", () => {
  assert.equal(matchRetail("паста альфредо", KW).isRetail, true);
  assert.equal(matchRetail("пасты альфредо", KW).isRetail, true);
});

test("matchRetail: не-розница не срабатывает", () => {
  assert.equal(matchRetail("пельмени", KW).isRetail, false);
  assert.equal(matchRetail("девочки", KW).isRetail, false);
  assert.equal(matchRetail("", KW).isRetail, false);
});
