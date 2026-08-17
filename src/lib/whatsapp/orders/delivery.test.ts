import { test } from "node:test";
import assert from "node:assert/strict";
import { deliveryFee, MIN_ORDER_AMOUNT } from "@/app/constants";

// Доставка по Алматы теперь БЕСПЛАТНАЯ на все заказы — deliveryFee всегда 0.
test("deliveryFee: доставка всегда бесплатная", () => {
  assert.equal(deliveryFee(0), 0);
  assert.equal(deliveryFee(9999), 0);
  assert.equal(deliveryFee(15000), 0);
  assert.equal(deliveryFee(50000), 0);
  assert.equal(deliveryFee(), 0);
});

// Минимальная сумма заказа — 15 000 ₸ (единый источник для сайта и бота).
test("MIN_ORDER_AMOUNT = 15000", () => {
  assert.equal(MIN_ORDER_AMOUNT, 15000);
});
