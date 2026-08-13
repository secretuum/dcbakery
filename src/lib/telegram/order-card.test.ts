import { test } from "node:test";
import assert from "node:assert/strict";
import type { Order, OrderItem } from "@/src/types";
import { buildOrderCard } from "./order-card";

function order(over: Record<string, unknown>): Order {
  return {
    id: "o1",
    order_number: "DCB-2026-000001",
    company_name: "Одуванчик",
    customer_name: "Иван",
    customer_phone: "77001234567",
    delivery_address: "",
    delivery_date: "2026-08-14",
    delivery_time: "Утро",
    status: "pending_manager_confirmation",
    payment_status: "unpaid",
    total_amount: 5000,
    delivery_amount: 1500,
    comment: null,
    ...over,
  } as unknown as Order;
}

const ITEMS = [
  { id: "i1", order_id: "o1", product_id: "medovik", product_name: "Медовик", unit: "шт.", qty: 2, price: 830, total_amount: 1660, category: null },
] as unknown as OrderItem[];

test("order-card: адрес и 2ГИС-поиск показаны ДАЖЕ при наличии даты доставки", () => {
  const { text } = buildOrderCard(order({ delivery_address: "Абая 10", delivery_date: "2026-08-14" }), ITEMS);
  assert.match(text, /Доставка: 2026-08-14/);
  assert.match(text, /📍 Адрес: Абая 10/);
  assert.match(text, /🗺 2ГИС: https:\/\/2gis\.kz\/almaty\/search\//);
});

test("order-card: геолокация → плейсхолдер-адрес без 2ГИС-поиска, точка-ссылка в комментарии", () => {
  const { text } = buildOrderCard(
    order({
      delivery_address: "Геолокация (см. карту)",
      comment: "📍 Геометка (2ГИС): https://2gis.kz/almaty/geo/76.9,43.2",
    }),
    ITEMS,
  );
  assert.match(text, /📍 Адрес: Геолокация/);
  assert.doesNotMatch(text, /🗺 2ГИС: https:\/\/2gis\.kz\/almaty\/search/); // по «Геолокация…» не ищем
  assert.match(text, /Геометка \(2ГИС\): https:\/\/2gis\.kz\/almaty\/geo/); // ссылка на точку в комментарии
});
