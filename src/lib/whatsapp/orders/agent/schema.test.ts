import { test } from "node:test";
import assert from "node:assert/strict";
import { parseAgentOutput } from "./schema";
import { LIMITS } from "../config";

const IDS = new Set(["medovik", "napoleon"]);

test("валидный вывод проходит", () => {
  const r = parseAgentOutput(
    { reply: "Добавил", cartActions: [{ productId: "medovik", quantity: 2, operation: "add" }], showCart: true, intent: "chat" },
    IDS,
  );
  assert.ok(r.ok);
  if (!r.ok) return;
  assert.equal(r.output.reply, "Добавил");
  assert.equal(r.output.cartActions.length, 1);
  assert.equal(r.output.showCart, true);
});

test("действия с НЕизвестным id отбрасываются (защита от выдумок/инъекций)", () => {
  const r = parseAgentOutput(
    {
      reply: "x",
      cartActions: [
        { productId: "'; DROP TABLE orders;--", quantity: 1, operation: "add" },
        { productId: "medovik", quantity: 1, operation: "add" },
      ],
      showCart: false,
      intent: "chat",
    },
    IDS,
  );
  assert.ok(r.ok);
  if (!r.ok) return;
  assert.equal(r.output.cartActions.length, 1);
  assert.equal(r.output.cartActions[0].productId, "medovik");
});

test("количество клэмпится, неверный intent → chat", () => {
  const r = parseAgentOutput(
    {
      reply: "",
      cartActions: [{ productId: "napoleon", quantity: 999999, operation: "hack" }],
      showCart: false,
      intent: "sudo",
    },
    IDS,
  );
  assert.ok(r.ok);
  if (!r.ok) return;
  assert.equal(r.output.intent, "chat");
  assert.equal(r.output.cartActions[0].quantity, LIMITS.maxItemQuantity);
  assert.equal(r.output.cartActions[0].operation, "add");
});

test("не-объект отбраковывается", () => {
  assert.equal(parseAgentOutput(null, IDS).ok, false);
  assert.equal(parseAgentOutput("текст", IDS).ok, false);
});

test("mood/handoffReason: извлекаются, дефолт — пустая строка", () => {
  const r = parseAgentOutput(
    { reply: "Передаю менеджеру.", cartActions: [], showCart: false, intent: "handoff", mood: "недоволен", handoffReason: "просит индивидуальную цену" },
    IDS,
  );
  assert.ok(r.ok);
  if (!r.ok) return;
  assert.equal(r.output.mood, "недоволен");
  assert.equal(r.output.handoffReason, "просит индивидуальную цену");

  // Поля отсутствуют в выводе модели → пустые строки (не падаем).
  const r2 = parseAgentOutput({ reply: "ок", cartActions: [], showCart: false, intent: "chat" }, IDS);
  assert.ok(r2.ok);
  if (!r2.ok) return;
  assert.equal(r2.output.mood, "");
  assert.equal(r2.output.handoffReason, "");
});
