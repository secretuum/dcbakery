import { test } from "node:test";
import assert from "node:assert/strict";
import { buildBusinessContext, type BusinessFacts } from "./business-context";

const FACTS: BusinessFacts = {
  workHours: "Пн–Пт 9:00–19:00",
  contactPhone: "+7 747 694 0766",
  contactWhatsapp: "+7 747 727 2650",
  address: "г. Алматы, ул. Жамбыла 154",
  deliveryDays: [2, 4, 6],
  orderCutoffHour: 18,
};

test("buildBusinessContext: часы, дни/отсечка, тариф, контакты", () => {
  const ctx = buildBusinessContext(FACTS);
  assert.match(ctx, /Пн–Пт 9:00–19:00/);
  assert.match(ctx, /вторник, четверг, суббота/); // отсортированные дни доставки
  assert.match(ctx, /до 18:00/);
  assert.match(ctx, /бесплатно/); // строка тарифа из describeDeliveryTariff
  assert.match(ctx, /\+7 747 694 0766/);
  assert.match(ctx, /Жамбыла 154/);
});

test("buildBusinessContext: воскресенье сортируется в конец, пустые дни → фолбэк", () => {
  assert.match(buildBusinessContext({ ...FACTS, deliveryDays: [0, 1] }), /понедельник, воскресенье/);
  assert.match(buildBusinessContext({ ...FACTS, deliveryDays: [] }), /по согласованию/);
});
