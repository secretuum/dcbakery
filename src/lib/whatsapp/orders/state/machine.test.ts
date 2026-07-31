import { test } from "node:test";
import assert from "node:assert/strict";
import {
  canTransition,
  transition,
  isTerminal,
  isBotSuppressed,
  isActiveOrdering,
} from "./machine";

test("canTransition: разрешённые переходы", () => {
  assert.equal(canTransition("idle", "building_cart"), true);
  assert.equal(canTransition("building_cart", "awaiting_cart_confirmation"), true);
  assert.equal(canTransition("awaiting_cart_confirmation", "awaiting_address"), true);
  assert.equal(canTransition("awaiting_delivery_period", "awaiting_final_confirmation"), true);
  assert.equal(canTransition("awaiting_final_confirmation", "creating_order"), true);
  assert.equal(canTransition("creating_order", "order_submitted"), true);
});

test("canTransition: запрещённые переходы", () => {
  assert.equal(canTransition("awaiting_address", "creating_order"), false);
  assert.equal(canTransition("idle", "order_submitted"), false);
  assert.equal(canTransition("idle", "idle"), false);
});

test("canTransition: отмена/handoff/протухание достижимы отовсюду", () => {
  for (const s of ["idle", "building_cart", "awaiting_address", "awaiting_final_confirmation"] as const) {
    assert.equal(canTransition(s, "human_handoff"), true);
    assert.equal(canTransition(s, "cancelled"), true);
    assert.equal(canTransition(s, "expired"), true);
  }
});

test("transition: невалидный переход оставляет прежнее состояние", () => {
  assert.equal(transition("awaiting_address", "creating_order"), "awaiting_address");
  assert.equal(transition("idle", "building_cart"), "building_cart");
});

test("предикаты состояний", () => {
  assert.equal(isTerminal("order_submitted"), true);
  assert.equal(isTerminal("cancelled"), true);
  assert.equal(isTerminal("building_cart"), false);
  assert.equal(isBotSuppressed("human_handoff"), true);
  assert.equal(isBotSuppressed("building_cart"), false);
  assert.equal(isActiveOrdering("awaiting_address"), true);
  assert.equal(isActiveOrdering("idle"), false);
  assert.equal(isActiveOrdering("human_handoff"), false);
});
