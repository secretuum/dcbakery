import { test } from "node:test";
import assert from "node:assert/strict";
import { canonicalClientPhone, canonicalClientEmail } from "./canonical";

test("canonicalClientPhone: разные форматы KZ-мобильного → +7XXXXXXXXXX", () => {
  assert.equal(canonicalClientPhone("+7 705 123 45 67"), "+77051234567");
  assert.equal(canonicalClientPhone("87051234567"), "+77051234567"); // ведущая 8 → 7
  assert.equal(canonicalClientPhone("77051234567"), "+77051234567");
});

test("canonicalClientPhone: не валидный мобильный → null", () => {
  assert.equal(canonicalClientPhone("+7 727 123 45 67"), null); // городской 72x
  assert.equal(canonicalClientPhone("12345"), null);
  assert.equal(canonicalClientPhone(""), null);
});

test("canonicalClientEmail: тримминг и нижний регистр", () => {
  assert.equal(canonicalClientEmail("  Cafe@Mail.KZ "), "cafe@mail.kz");
});

test("canonicalClientEmail: пусто/undefined → null", () => {
  assert.equal(canonicalClientEmail(""), null);
  assert.equal(canonicalClientEmail("   "), null);
  assert.equal(canonicalClientEmail(undefined), null);
  assert.equal(canonicalClientEmail(null), null);
});
