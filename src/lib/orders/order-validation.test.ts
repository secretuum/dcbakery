import { test } from "node:test";
import assert from "node:assert/strict";
import type { Product } from "@/src/types";
import { resolveCartItems, validateOrderFields } from "./order-validation";

// tomorrowDate передаём явно, чтобы тест был детерминированным.
const TOMORROW = "2026-08-04";
const DELIVERY_DAYS = [2, 4, 6]; // вт/чт/сб
const THURSDAY = "2026-08-06"; // будущее + разрешённый день (weekday 4)

function body(over: Record<string, unknown> = {}) {
  return {
    company_name: "ООО Кафе",
    customer_name: "Иван",
    customer_phone: "+7 747 123 45 67", // 11 цифр
    delivery_date: THURSDAY,
    items: [{ product_id: "medovik", qty: 2, price: 830 }],
    payment_method: "Выставить счет",
    oferta_accepted: true,
    ...over,
  };
}

test("validateOrderFields: валидный заказ — без ошибок, сумма верная", () => {
  const { errors, totalAmount } = validateOrderFields(body(), DELIVERY_DAYS, TOMORROW);
  assert.deepEqual(errors, []);
  assert.equal(totalAmount, 1660); // 2×830
});

test("validateOrderFields: обязательные поля", () => {
  assert.ok(validateOrderFields(body({ company_name: "" }), DELIVERY_DAYS, TOMORROW).errors.includes("company_name is required"));
  assert.ok(validateOrderFields(body({ customer_name: "" }), DELIVERY_DAYS, TOMORROW).errors.includes("customer_name is required"));
  assert.ok(validateOrderFields(body({ oferta_accepted: false }), DELIVERY_DAYS, TOMORROW).errors.includes("oferta must be accepted"));
});

test("validateOrderFields: короткий телефон", () => {
  const { errors } = validateOrderFields(body({ customer_phone: "+7 747 12" }), DELIVERY_DAYS, TOMORROW);
  assert.ok(errors.includes("customer_phone is invalid"));
});

test("validateOrderFields: дата доставки — раньше завтра / неразрешённый день", () => {
  assert.ok(
    validateOrderFields(body({ delivery_date: "2026-08-03" }), DELIVERY_DAYS, TOMORROW).errors.includes(
      "delivery_date must be tomorrow or later",
    ),
  );
  // 2026-08-05 — среда (weekday 3), не в [2,4,6]
  assert.ok(
    validateOrderFields(body({ delivery_date: "2026-08-05" }), DELIVERY_DAYS, TOMORROW).errors.includes(
      "delivery_date is not an allowed delivery day",
    ),
  );
});

test("validateOrderFields: неверный способ оплаты", () => {
  const { errors } = validateOrderFields(body({ payment_method: "Наличными" }), DELIVERY_DAYS, TOMORROW);
  assert.ok(errors.includes("payment_method is invalid"));
});

test("validateOrderFields: нулевая сумма (quote-позиции по 0) — заблокирована", () => {
  const { errors, totalAmount } = validateOrderFields(
    body({ items: [{ product_id: "x", qty: 1, price: 0 }] }),
    DELIVERY_DAYS,
    TOMORROW,
  );
  assert.equal(totalAmount, 0);
  assert.ok(errors.includes("order total must be greater than zero"));
});

test("validateOrderFields: пустые позиции", () => {
  const { errors } = validateOrderFields(body({ items: [] }), DELIVERY_DAYS, TOMORROW);
  assert.ok(errors.includes("items are required"));
});

// ——— resolveCartItems ———

function product(id: string, name: string, price: number, stock: number, min = 1): Product {
  return {
    id, name, slug: id, description: "", category_id: "cat", price, unit: "шт",
    min_qty: min, step_qty: 1, stock_qty: stock, images: [], is_active: true, sort_order: 0,
  };
}

const PRODUCTS: Product[] = [
  product("medovik", "Медовик", 830, 50),
  product("napoleon", "Наполеон", 2500, 2),
  product("nostock", "Нет в наличии", 100, 0),
  product("minfive", "Минимум 5", 100, 50, 5),
];

test("resolveCartItems: валидная позиция резолвится", () => {
  const { errors, resolvedItems } = resolveCartItems([{ product_id: "medovik", qty: 2 }], PRODUCTS);
  assert.deepEqual(errors, []);
  assert.deepEqual(resolvedItems, [{ product_id: "medovik", qty: 2 }]);
});

test("resolveCartItems: неизвестный товар / нет в наличии / дробное / сверх остатка / ниже минимума", () => {
  assert.match(resolveCartItems([{ product_id: "ghost", qty: 1 }], PRODUCTS).errors[0], /unknown product/);
  assert.match(resolveCartItems([{ product_id: "nostock", qty: 1 }], PRODUCTS).errors[0], /out of stock/);
  assert.match(resolveCartItems([{ product_id: "medovik", qty: 1.5 }], PRODUCTS).errors[0], /whole number/);
  assert.match(resolveCartItems([{ product_id: "napoleon", qty: 5 }], PRODUCTS).errors[0], /exceeds stock/);
  assert.match(resolveCartItems([{ product_id: "minfive", qty: 2 }], PRODUCTS).errors[0], /below minimum/);
});

test("resolveCartItems: смешанный список — валидные проходят, невалидные в ошибки", () => {
  const { errors, resolvedItems } = resolveCartItems(
    [
      { product_id: "medovik", qty: 2 },
      { product_id: "ghost", qty: 1 },
      { product_id: "napoleon", qty: 5 },
    ],
    PRODUCTS,
  );
  assert.deepEqual(resolvedItems, [{ product_id: "medovik", qty: 2 }]);
  assert.equal(errors.length, 2);
});
