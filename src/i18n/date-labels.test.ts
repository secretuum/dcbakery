import { test } from "node:test";
import assert from "node:assert/strict";
import {
  getDateLabelFormatter,
  formatMediumDate,
  KK_WEEKDAYS_SHORT,
  KK_MONTHS_SHORT,
} from "./date-labels";

// Локальные даты (не UTC): getDay/getMonth/getDate читают локальное время,
// так тест не съезжает в зависимости от TZ раннера.
const d = (month: number, day: number) => new Date(2024, month, day);

test("kk: массивы покрывают 7 дней и 12 месяцев", () => {
  assert.equal(KK_WEEKDAYS_SHORT.length, 7);
  assert.equal(KK_MONTHS_SHORT.length, 12);
});

test("kk: короткие дни недели по индексу getDay() (эталон CLDR)", () => {
  const f = getDateLabelFormatter("kk");
  // 2024-01-07 — воскресенье (getDay()=0), дальше по возрастанию
  const expected = ["жс", "дс", "сс", "ср", "бс", "жм", "сб"];
  for (let i = 0; i < 7; i++) {
    assert.equal(f.weekday(d(0, 7 + i)), expected[i]);
  }
});

test("kk: день + короткий месяц без Intl и без точки", () => {
  const f = getDateLabelFormatter("kk");
  assert.equal(f.day(d(7, 1)), "1 там"); // тамыз (август)
  assert.equal(f.day(d(0, 15)), "15 қаң"); // қаңтар (январь)
  assert.equal(f.day(d(11, 31)), "31 жел"); // желтоқсан (декабрь)
});

test("ru: подпись дня через Intl без точки сокращения", () => {
  const f = getDateLabelFormatter("ru");
  assert.equal(f.day(d(7, 1)), "1 авг");
  assert.equal(f.weekday(d(0, 7)), "вс");
});

test("en: подпись дня через Intl (порядок месяц-день, как принято в en)", () => {
  const f = getDateLabelFormatter("en");
  assert.equal(f.day(d(7, 1)), "Aug 1");
  assert.equal(f.weekday(d(0, 7)), "Sun");
});

test("formatMediumDate kk: день-первый + короткий месяц + год + «ж.»", () => {
  assert.equal(formatMediumDate(new Date(2026, 7, 1), "kk"), "1 там. 2026 ж.");
  assert.equal(formatMediumDate(new Date(2026, 0, 9), "kk"), "9 қаң. 2026 ж.");
});

test("formatMediumDate ru: байт-в-байт как Intl dateStyle:medium", () => {
  const dt = new Date(2026, 7, 1);
  const expected = new Intl.DateTimeFormat("ru-RU", { dateStyle: "medium" }).format(dt);
  assert.equal(formatMediumDate(dt, "ru"), expected); // «1 авг. 2026 г.»
});

test("formatMediumDate en: английский medium", () => {
  assert.equal(formatMediumDate(new Date(2026, 7, 1), "en"), "Aug 1, 2026");
});

test("formatMediumDate: невалидная дата → пустая строка (без throw)", () => {
  assert.equal(formatMediumDate(new Date("не дата"), "kk"), "");
  assert.equal(formatMediumDate(new Date("не дата"), "ru"), "");
});
