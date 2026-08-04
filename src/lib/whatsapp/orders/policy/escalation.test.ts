import { test } from "node:test";
import assert from "node:assert/strict";
import { detectEscalation } from "./escalation";

test("эскалация: жалобы/угрозы", () => {
  assert.equal(detectEscalation("вы мошенники, верните деньги").reason, "complaint");
  assert.equal(detectEscalation("напишу жалобу и оставлю плохой отзыв").reason, "complaint");
  assert.equal(detectEscalation("подам в суд на вас").reason, "complaint");
});

test("эскалация: мат и оскорбления", () => {
  assert.equal(detectEscalation("блять почему так дорого").reason, "profanity");
  assert.equal(detectEscalation("ты тупой бот").reason, "insult");
  assert.equal(detectEscalation("вы дебилы").reason, "insult");
});

test("эскалация: КАПС (крик)", () => {
  assert.equal(detectEscalation("ПОЧЕМУ НИКТО НЕ ОТВЕЧАЕТ АЛО").reason, "shouting");
});

test("нет ложных срабатываний на обычных словах", () => {
  assert.equal(detectEscalation("10 наполеонов и 5 медовиков").escalate, false);
  assert.equal(detectEscalation("оплата 5000 рубля… ой, тенге").escalate, false); // «рубля» ≠ мат
  assert.equal(detectEscalation("требую счёт на оплату").escalate, false); // «требую» ≠ мат
  assert.equal(detectEscalation("хлеб есть в наличии?").escalate, false);
  assert.equal(detectEscalation("СРОЧНО").escalate, false); // короткое, не крик
});
