import { test } from "node:test";
import assert from "node:assert/strict";
import { timingSafeCompare } from "./timing-safe";

test("timingSafeCompare: равные строки → true", () => {
  assert.equal(timingSafeCompare("secret-abc-123", "secret-abc-123"), true);
});

test("timingSafeCompare: разные той же длины → false", () => {
  assert.equal(timingSafeCompare("secret-abc-123", "secret-abc-124"), false);
});

test("timingSafeCompare: разная длина → false (без исключения)", () => {
  assert.equal(timingSafeCompare("short", "much-longer-secret"), false);
});

test("timingSafeCompare: null/undefined → false", () => {
  assert.equal(timingSafeCompare(null, "x"), false);
  assert.equal(timingSafeCompare("x", undefined), false);
  assert.equal(timingSafeCompare(null, null), false);
  assert.equal(timingSafeCompare("", ""), true);
});
