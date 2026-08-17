import { test } from "node:test";
import assert from "node:assert/strict";
import { formatBotStats, formatTenge, type BotStats } from "./bot-stats-format";

test("formatTenge: пробел в тысячах + ₸", () => {
  assert.equal(formatTenge(0), "0 ₸");
  assert.equal(formatTenge(1000), "1 000 ₸");
  assert.equal(formatTenge(1234567), "1 234 567 ₸");
  assert.equal(formatTenge(999), "999 ₸");
  assert.equal(formatTenge(NaN), "0 ₸"); // защита
});

test("formatBotStats: все метрики в тексте", () => {
  const s: BotStats = {
    orders7d: 12,
    orders30d: 47,
    revenue7d: 240000,
    revenue30d: 910000,
    dialogs7d: 63,
    dialogs30d: 210,
    handoffOpen: 3,
    leadsOpen: 5,
  };
  const text = formatBotStats(s);
  assert.match(text, /Статистика бота/);
  assert.match(text, /За 7 дней/);
  assert.match(text, /Диалогов: 63/);
  assert.match(text, /Заказов через бота: 12 на 240 000 ₸/);
  assert.match(text, /За 30 дней/);
  assert.match(text, /Диалогов: 210/);
  assert.match(text, /Заказов через бота: 47 на 910 000 ₸/);
  assert.match(text, /Передано менеджеру \(в работе\): 3/);
  assert.match(text, /Открытых обращений к менеджеру: 5/);
});
