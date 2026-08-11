import { test } from "node:test";
import assert from "node:assert/strict";
import {
  buildEscalationMessage,
  describeLeadReason,
  moodFromReason,
  urgencyFromText,
  type EscalationContext,
} from "./escalation-context";

test("urgencyFromText: срочность распознаётся", () => {
  assert.equal(urgencyFromText("нужно срочно, доставьте сегодня"), true);
  assert.equal(urgencyFromText("это горит!"), true);
  assert.equal(urgencyFromText("хочу два медовика"), false);
});

test("moodFromReason: абьюз → агрессивен, жалоба → недоволен", () => {
  assert.equal(moodFromReason("profanity"), "агрессивен");
  assert.equal(moodFromReason("complaint"), "недоволен");
  assert.equal(moodFromReason("shouting"), "раздражён");
});

test("describeLeadReason: escalation:* срочные и с настроением", () => {
  const c = describeLeadReason("escalation:complaint");
  assert.equal(c.urgent, true);
  assert.equal(c.mood, "недоволен");
  assert.match(c.why, /жалоб|претенз|угроз/i);

  const h = describeLeadReason("agent_handoff");
  assert.equal(h.urgent, false);
  assert.equal(h.mood, null);

  assert.equal(describeLeadReason("order_create_failed").urgent, true);
  assert.equal(describeLeadReason("missing_phone").mood, null);
});

test("buildEscalationMessage: все поля, флаг «горит»", () => {
  const ctx: EscalationContext = {
    chatId: "7700000@c.us",
    clientPhone: "77001234567",
    clientWanted: "хочу скидку 30%",
    botAnswered: "Скидку подтвердит менеджер.",
    reason: "agent_handoff",
    whyUnresolved: "клиент просит индивидуальную цену",
    mood: "сомневается",
    urgent: true,
  };
  const msg = buildEscalationMessage(ctx);
  assert.match(msg, /🔥 ГОРИТ/);
  assert.match(msg, /Клиент: 77001234567/);
  assert.match(msg, /Настроение: сомневается/);
  assert.match(msg, /Хотел: хочу скидку 30%/);
  assert.match(msg, /Ответ бота: Скидку подтвердит менеджер\./);
  assert.match(msg, /Почему не решилось: клиент просит индивидуальную цену/);
  assert.match(msg, /Чат: 7700000@c\.us/);
});

test("buildEscalationMessage: без настроения/ответа/номера и без «горит»", () => {
  const msg = buildEscalationMessage({
    chatId: "c1",
    clientPhone: null,
    clientWanted: "",
    botAnswered: null,
    reason: "unsupported_attachment",
    whyUnresolved: "вложение",
    mood: null,
    urgent: false,
  });
  assert.doesNotMatch(msg, /ГОРИТ/);
  assert.doesNotMatch(msg, /Настроение:/); // mood=null → строка опущена
  assert.match(msg, /Клиент: номер неизвестен/);
  assert.match(msg, /Хотел: —/);
  assert.match(msg, /Ответ бота: —/);
});
