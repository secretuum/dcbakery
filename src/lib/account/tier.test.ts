import { test } from "node:test";
import assert from "node:assert/strict";
import {
  getAccountTier,
  isOverLiteCap,
  shipmentBlockedForPrepay,
  LITE_ORDER_CAP,
} from "./tier";

// ——— getAccountTier ———

test("getAccountTier: credit_limit>0 → full (даже без БИН/адреса)", () => {
  assert.equal(getAccountTier({ creditLimit: 100000 }), "full");
  assert.equal(getAccountTier({ customerBin: "", hasAddress: false, creditLimit: 1 }), "full");
});

test("getAccountTier: БИН + адрес → full", () => {
  assert.equal(
    getAccountTier({ customerBin: "123456789012", hasAddress: true, creditLimit: 0 }),
    "full",
  );
});

test("getAccountTier: только БИН / только адрес → lite", () => {
  assert.equal(getAccountTier({ customerBin: "123456789012", hasAddress: false }), "lite");
  assert.equal(getAccountTier({ customerBin: "", hasAddress: true }), "lite");
});

test("getAccountTier: ни БИН, ни адреса, ни кредита → lite", () => {
  assert.equal(getAccountTier({}), "lite");
  assert.equal(getAccountTier({ customerBin: null, hasAddress: null, creditLimit: null }), "lite");
});

test("getAccountTier: пробельный БИН не считается заполненным", () => {
  assert.equal(getAccountTier({ customerBin: "   ", hasAddress: true }), "lite");
});

// ——— isOverLiteCap ———

test("isOverLiteCap: лайт выше потолка → true; ровно на потолке → false", () => {
  assert.equal(isOverLiteCap("lite", LITE_ORDER_CAP + 1), true);
  assert.equal(isOverLiteCap("lite", LITE_ORDER_CAP), false); // граница включительна
  assert.equal(isOverLiteCap("lite", LITE_ORDER_CAP - 1), false);
});

test("isOverLiteCap: полный аккаунт не ограничен потолком", () => {
  assert.equal(isOverLiteCap("full", LITE_ORDER_CAP * 10), false);
});

// ——— shipmentBlockedForPrepay ———

test("shipmentBlockedForPrepay: заказ без клиента не блокируется", () => {
  assert.equal(
    shipmentBlockedForPrepay({ targetStatus: "in_progress", paymentStatus: "unpaid", creditLimit: 0, hasClient: false }),
    false,
  );
});

test("shipmentBlockedForPrepay: не-отгрузочный статус не блокируется", () => {
  assert.equal(
    shipmentBlockedForPrepay({ targetStatus: "confirmed_waiting_payment", paymentStatus: "unpaid", creditLimit: 0, hasClient: true }),
    false,
  );
});

test("shipmentBlockedForPrepay: предоплатный клиент, неоплачено, отгрузка → блок (все три статуса)", () => {
  for (const status of ["in_progress", "delivering", "completed"]) {
    assert.equal(
      shipmentBlockedForPrepay({ targetStatus: status, paymentStatus: "unpaid", creditLimit: 0, hasClient: true }),
      true,
      `ожидался блок для статуса ${status}`,
    );
  }
});

test("shipmentBlockedForPrepay: оплачено → не блокируется", () => {
  assert.equal(
    shipmentBlockedForPrepay({ targetStatus: "delivering", paymentStatus: "paid", creditLimit: 0, hasClient: true }),
    false,
  );
});

test("shipmentBlockedForPrepay: есть отсрочка (credit_limit>0) → не мешаем консигнации", () => {
  assert.equal(
    shipmentBlockedForPrepay({ targetStatus: "in_progress", paymentStatus: "unpaid", creditLimit: 50000, hasClient: true }),
    false,
  );
});
