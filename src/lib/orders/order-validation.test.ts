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
    items: [{ product_id: "medovik", qty: 2, price: 8000 }],
    payment_method: "Выставить счет",
    oferta_accepted: true,
    ...over,
  };
}

test("validateOrderFields: валидный заказ — без ошибок, сумма верная", () => {
  const { errors, totalAmount } = validateOrderFields(body(), DELIVERY_DAYS, TOMORROW);
  assert.deepEqual(errors, []);
  assert.equal(totalAmount, 16000); // 2×8000 (≥ минимума 15 000)
});

test("validateOrderFields: обязательные поля", () => {
  assert.ok(validateOrderFields(body({ company_name: "" }), DELIVERY_DAYS, TOMORROW).errors.includes("company_name is required"));
  assert.ok(validateOrderFields(body({ customer_name: "" }), DELIVERY_DAYS, TOMORROW).errors.includes("customer_name is required"));
  assert.ok(validateOrderFields(body({ oferta_accepted: false }), DELIVERY_DAYS, TOMORROW).errors.includes("oferta must be accepted"));
});

test("validateOrderFields: БИН обязателен для юрлица/ИП", () => {
  const BIN_ERR = "customer_bin is required for legal/ip";
  // Юрлицо без БИН — ошибка; с валидным БИН — нет.
  assert.ok(validateOrderFields(body({ customer_type: "legal" }), DELIVERY_DAYS, TOMORROW).errors.includes(BIN_ERR));
  assert.ok(
    !validateOrderFields(body({ customer_type: "legal", customer_bin: "971240001315" }), DELIVERY_DAYS, TOMORROW).errors.includes(BIN_ERR),
  );
  // ИП без БИН — ошибка.
  assert.ok(validateOrderFields(body({ customer_type: "ip" }), DELIVERY_DAYS, TOMORROW).errors.includes(BIN_ERR));
  // Физлицо — БИН не требуется.
  assert.ok(!validateOrderFields(body({ customer_type: "individual" }), DELIVERY_DAYS, TOMORROW).errors.includes(BIN_ERR));
  // Тип не задан (старый клиент) — требование не навязываем.
  assert.ok(!validateOrderFields(body(), DELIVERY_DAYS, TOMORROW).errors.includes(BIN_ERR));
  // Невалидный БИН (не 12 цифр) у юрлица — ошибка.
  assert.ok(validateOrderFields(body({ customer_type: "legal", customer_bin: "12345" }), DELIVERY_DAYS, TOMORROW).errors.includes(BIN_ERR));
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

// ——— validateOrderFields: непокрытые ветви ———

test("validateOrderFields: дата доставки отсутствует → required", () => {
  const { errors } = validateOrderFields(body({ delivery_date: "" }), DELIVERY_DAYS, TOMORROW);
  assert.ok(errors.includes("delivery_date is required"));
  // Именно required, а не «раньше завтра» (ветви взаимоисключающие).
  assert.ok(!errors.includes("delivery_date must be tomorrow or later"));
});

test("validateOrderFields: дата ровно на завтра (разрешённый день) — проходит", () => {
  // TOMORROW=2026-08-04 — вторник (weekday 2), входит в [2,4,6].
  const { errors } = validateOrderFields(body({ delivery_date: TOMORROW }), DELIVERY_DAYS, TOMORROW);
  assert.ok(!errors.some((e) => e.startsWith("delivery_date")));
});

test("validateOrderFields: пустой список дней доставки → любой будущий день разрешён", () => {
  // 2026-08-05 (среда) обычно вне [2,4,6], но при deliveryDays=[] проверка дня пропускается.
  const { errors } = validateOrderFields(body({ delivery_date: "2026-08-05" }), [], TOMORROW);
  assert.ok(!errors.some((e) => e.startsWith("delivery_date")));
});

test("validateOrderFields: способ оплаты отсутствует → invalid", () => {
  const { errors } = validateOrderFields(body({ payment_method: undefined }), DELIVERY_DAYS, TOMORROW);
  assert.ok(errors.includes("payment_method is invalid"));
});

test("validateOrderFields: полностью пустой заказ — все ошибки накапливаются", () => {
  const { errors, totalAmount } = validateOrderFields(
    {
      company_name: "",
      customer_name: "",
      customer_phone: "",
      delivery_date: "",
      items: [],
      payment_method: "",
      oferta_accepted: false,
    },
    DELIVERY_DAYS,
    TOMORROW,
  );
  assert.equal(totalAmount, 0);
  assert.equal(errors.length, 8);
  for (const expected of [
    "company_name is required",
    "customer_name is required",
    "customer_phone is invalid",
    "delivery_date is required",
    "items are required",
    "payment_method is invalid",
    "order total must be greater than zero",
    "oferta must be accepted",
  ]) {
    assert.ok(errors.includes(expected), `ожидалась ошибка: ${expected}`);
  }
});

// ——— resolveCartItems: граничные значения ———

test("resolveCartItems: qty ровно равно остатку — проходит", () => {
  // napoleon: остаток 2
  const { errors, resolvedItems } = resolveCartItems([{ product_id: "napoleon", qty: 2 }], PRODUCTS);
  assert.deepEqual(errors, []);
  assert.deepEqual(resolvedItems, [{ product_id: "napoleon", qty: 2 }]);
});

test("resolveCartItems: qty ровно равно минимуму — проходит", () => {
  // minfive: min_qty 5
  const { errors, resolvedItems } = resolveCartItems([{ product_id: "minfive", qty: 5 }], PRODUCTS);
  assert.deepEqual(errors, []);
  assert.deepEqual(resolvedItems, [{ product_id: "minfive", qty: 5 }]);
});

test("resolveCartItems: нулевое и отрицательное qty — отбрасываются (ниже минимума)", () => {
  const zero = resolveCartItems([{ product_id: "medovik", qty: 0 }], PRODUCTS);
  assert.deepEqual(zero.resolvedItems, []);
  assert.match(zero.errors[0], /below minimum/);

  const negative = resolveCartItems([{ product_id: "medovik", qty: -3 }], PRODUCTS);
  assert.deepEqual(negative.resolvedItems, []);
  assert.match(negative.errors[0], /below minimum/);
});

test("resolveCartItems: пустой список позиций → пусто, без ошибок", () => {
  const { errors, resolvedItems } = resolveCartItems([], PRODUCTS);
  assert.deepEqual(errors, []);
  assert.deepEqual(resolvedItems, []);
});
