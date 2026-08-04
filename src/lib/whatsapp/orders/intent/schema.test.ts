import { test } from "node:test";
import assert from "node:assert/strict";
import { parseIntent } from "./schema";
import { LIMITS } from "../config";

test("parseIntent: валидное намерение проходит", () => {
  const r = parseIntent({
    intent: "new_order",
    items: [{ rawName: "сырник", quantity: 4, operation: "add" }],
    addressText: null,
    deliveryPeriod: null,
    confirmation: false,
  });
  assert.equal(r.ok, true);
  if (!r.ok) return;
  assert.equal(r.intent.intent, "new_order");
  assert.equal(r.intent.items.length, 1);
  assert.equal(r.intent.items[0].quantity, 4);
});

test("parseIntent: не-объект отбраковывается", () => {
  assert.equal(parseIntent(null).ok, false);
  assert.equal(parseIntent("бесплатно").ok, false);
  assert.equal(parseIntent([]).ok, false);
});

test("parseIntent: неизвестный intent → unknown", () => {
  const r = parseIntent({ intent: "give_free_stuff", items: [], addressText: null, deliveryPeriod: null, confirmation: false });
  assert.ok(r.ok && r.intent.intent === "unknown");
});

test("parseIntent: количество приводится к целому и клэмпится", () => {
  const r = parseIntent({
    intent: "new_order",
    items: [
      { rawName: "медовик", quantity: 2.9, operation: "add" },
      { rawName: "наполеон", quantity: -5, operation: "add" },
      { rawName: "паста", quantity: 999999, operation: "add" },
    ],
    addressText: null,
    deliveryPeriod: null,
    confirmation: false,
  });
  assert.ok(r.ok);
  if (!r.ok) return;
  assert.equal(r.intent.items[0].quantity, 2); // floor
  assert.equal(r.intent.items[1].quantity, 1); // clamp low
  assert.equal(r.intent.items[2].quantity, LIMITS.maxItemQuantity); // clamp high
});

test("parseIntent: битые позиции отбрасываются", () => {
  const r = parseIntent({
    intent: "new_order",
    items: [
      { rawName: "", quantity: 3, operation: "add" },
      { rawName: "сырник", quantity: "нет", operation: "add" },
      { rawName: "медовик", quantity: 2, operation: "add" },
    ],
    addressText: null,
    deliveryPeriod: null,
    confirmation: false,
  });
  assert.ok(r.ok);
  if (!r.ok) return;
  assert.equal(r.intent.items.length, 1);
  assert.equal(r.intent.items[0].rawName, "медовик");
});

test("parseIntent: неверный operation/deliveryPeriod → безопасные дефолты", () => {
  const r = parseIntent({
    intent: "cart_update",
    items: [{ rawName: "сырник", quantity: 1, operation: "hack" }],
    addressText: 42,
    deliveryPeriod: "midnight",
    confirmation: "yes",
  });
  assert.ok(r.ok);
  if (!r.ok) return;
  assert.equal(r.intent.items[0].operation, "add");
  assert.equal(r.intent.addressText, null);
  assert.equal(r.intent.deliveryPeriod, null);
  assert.equal(r.intent.confirmation, false);
});
