import { test } from "node:test";
import assert from "node:assert/strict";
import {
  parseKnowledge,
  serializeKnowledge,
  appendKnowledge,
  renderKnowledge,
  formatKnowledgeList,
  MAX_KNOWLEDGE_ENTRIES,
  type BotKnowledgeEntry,
} from "./knowledge-store";

test("parseKnowledge: мусор/пусто → []", () => {
  assert.deepEqual(parseKnowledge(null), []);
  assert.deepEqual(parseKnowledge(""), []);
  assert.deepEqual(parseKnowledge("не json"), []);
  assert.deepEqual(parseKnowledge("{}"), []); // не массив
  assert.deepEqual(parseKnowledge('[{"author":"x"}]'), []); // нет text
});

test("parseKnowledge: валидные записи, пустой text отбрасывается", () => {
  const raw = JSON.stringify([
    { text: "Новый торт Прага 3000 ₸", author: "Аня", at: "2026-08-11T10:00:00.000Z" },
    { text: "   ", author: "x", at: "" }, // пустой → выкинут
    { text: "Акция -10% на медовик до пятницы" },
  ]);
  const entries = parseKnowledge(raw);
  assert.equal(entries.length, 2);
  assert.equal(entries[0].text, "Новый торт Прага 3000 ₸");
  assert.equal(entries[1].author, ""); // отсутствующий author → ""
});

test("appendKnowledge: добавляет, обрезает пустое, капит количество", () => {
  let entries: BotKnowledgeEntry[] = [];
  entries = appendKnowledge(entries, "факт 1", "Аня", "2026-08-11T10:00:00.000Z");
  entries = appendKnowledge(entries, "   ", "Аня", "t"); // пустой — игнор
  assert.equal(entries.length, 1);

  // Переполнение — храним последние MAX.
  for (let i = 0; i < MAX_KNOWLEDGE_ENTRIES + 5; i++) {
    entries = appendKnowledge(entries, `факт ${i}`, "Аня", "t");
  }
  assert.equal(entries.length, MAX_KNOWLEDGE_ENTRIES);
  assert.equal(entries[entries.length - 1].text, `факт ${MAX_KNOWLEDGE_ENTRIES + 4}`);
});

test("serialize/parse — круговой рейс", () => {
  const entries = appendKnowledge([], "Халяль-сертификат обновлён", "Аня", "2026-08-11T10:00:00.000Z");
  assert.deepEqual(parseKnowledge(serializeKnowledge(entries)), entries);
});

test("renderKnowledge: пусто → '', иначе помечено как ДОПОЛНЕНИЕ", () => {
  assert.equal(renderKnowledge([]), "");
  const r = renderKnowledge([{ text: "Акция на пельмени", author: "Аня", at: "t" }]);
  assert.match(r, /ОПЕРАТИВНЫЕ ОБНОВЛЕНИЯ/);
  assert.match(r, /НЕ отменяются/);
  assert.match(r, /- Акция на пельмени/);
});

test("formatKnowledgeList: пусто → подсказка, иначе нумерованный список", () => {
  assert.match(formatKnowledgeList([]), /пуста/i);
  const list = formatKnowledgeList([{ text: "Факт A", author: "Аня", at: "2026-08-11T10:00:00.000Z" }]);
  assert.match(list, /1\. Факт A/);
  assert.match(list, /2026-08-11/);
});
