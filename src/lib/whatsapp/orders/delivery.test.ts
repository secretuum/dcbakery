import { test } from "node:test";
import assert from "node:assert/strict";
import { deliveryFee } from "@/app/constants";

// Единый источник тарифа доставки — app/constants.ts. Проверяем границы,
// которые требует бизнес-правило WhatsApp-оформления.
test("deliveryFee: границы тарифов", () => {
  assert.equal(deliveryFee(9999), 3000);
  assert.equal(deliveryFee(10000), 1500);
  assert.equal(deliveryFee(14999), 1500);
  assert.equal(deliveryFee(15000), 0);
  assert.equal(deliveryFee(20000), 0);
  assert.equal(deliveryFee(0), 3000);
});
