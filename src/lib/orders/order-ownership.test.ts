import { test } from "node:test";
import assert from "node:assert/strict";
import { orderMatchesSession } from "./order-ownership";

test("совпадение по телефону (разные форматы → одинаковые цифры)", () => {
  assert.equal(
    orderMatchesSession(
      { customer_phone: "+7 747 123 45 67" },
      { phone: "77471234567" },
    ),
    true,
  );
});

test("совпадение по email (регистронезависимо, с пробелами)", () => {
  assert.equal(
    orderMatchesSession({ customer_email: "Cafe@Mail.KZ" }, { email: " cafe@mail.kz " }),
    true,
  );
});

test("НЕ совпадает: разные телефоны и почты", () => {
  assert.equal(
    orderMatchesSession(
      { customer_phone: "77470000000", customer_email: "a@a.kz" },
      { phone: "77471234567", email: "b@b.kz" },
    ),
    false,
  );
});

test("БЕЗОПАСНОСТЬ: пустой телефон сессии НЕ матчит заказ с не-цифровым телефоном", () => {
  // digits("нет")==="" и digits("")==="" — раньше это ложно совпадало.
  assert.equal(
    orderMatchesSession({ customer_phone: "нет", customer_email: "owner@x.kz" }, { phone: "", email: "" }),
    false,
  );
  assert.equal(
    orderMatchesSession({ customer_phone: "", customer_email: "owner@x.kz" }, { phone: "", email: "" }),
    false,
  );
});

test("пустой email обеих сторон не даёт совпадения", () => {
  assert.equal(
    orderMatchesSession({ customer_phone: "77470000000", customer_email: "" }, { phone: "77471234567", email: "" }),
    false,
  );
});

test("OR-логика: совпадение только по email при разных телефонах → владелец", () => {
  assert.equal(
    orderMatchesSession(
      { customer_phone: "77470000000", customer_email: "cafe@mail.kz" },
      { phone: "77479999999", email: "Cafe@Mail.kz" },
    ),
    true,
  );
});

test("OR-логика: совпадение только по телефону при разных email → владелец", () => {
  assert.equal(
    orderMatchesSession(
      { customer_phone: "+7 747 123 45 67", customer_email: "a@a.kz" },
      { phone: "77471234567", email: "z@z.kz" },
    ),
    true,
  );
});
