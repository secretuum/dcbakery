import { test } from "node:test";
import assert from "node:assert/strict";
import {
  isValidBin,
  normalizeBinInput,
  requiresBin,
  normalizeCompanyName,
  compareCompanyNames,
  isAlmatyCity,
  buildBinVerdict,
  type CompanyRecord,
} from "./company-check";

// Фикстура записи реестра: чистое активное ТОО в Алматы, без флагов.
function record(over: Partial<CompanyRecord> = {}): CompanyRecord {
  return {
    found: true,
    isIndividual: false,
    titleRu: 'ТОО "РОМАШКА"',
    titleKz: null,
    status: "Активен",
    cityName: "Г.АЛМАТЫ",
    addressRu: "г. Алматы, ул. Наурызбай батыра, 154",
    ceo: "ИВАНОВ И.И.",
    primaryOked: "Розничная торговля",
    flags: { fakeCompany: false, bankrupt: false, inactive: false, taxDebt: false, badGoszakup: false },
    debtTotal: 0,
    ...over,
  };
}

test("isValidBin: ровно 12 цифр", () => {
  assert.equal(isValidBin("971240001315"), true);
  assert.equal(isValidBin(" 971240001315 "), true);
  assert.equal(isValidBin("97124000131"), false); // 11
  assert.equal(isValidBin("9712400013150"), false); // 13
  assert.equal(isValidBin("97124000131a"), false);
  assert.equal(isValidBin(""), false);
  assert.equal(isValidBin(null), false);
  assert.equal(isValidBin(undefined), false);
});

test("normalizeBinInput: только цифры", () => {
  assert.equal(normalizeBinInput("971 240 001 315"), "971240001315");
  assert.equal(normalizeBinInput("БИН: 971240001315"), "971240001315");
  assert.equal(normalizeBinInput(null), "");
});

test("requiresBin: юрлицо/ИП — да, физлицо — нет", () => {
  assert.equal(requiresBin("legal"), true);
  assert.equal(requiresBin("ip"), true);
  assert.equal(requiresBin("individual"), false);
});

test("normalizeCompanyName: срезает орг-форму, кавычки, ё", () => {
  assert.equal(normalizeCompanyName('ТОО "Ромашка"'), "ромашка");
  assert.equal(normalizeCompanyName("ромашка"), "ромашка");
  assert.equal(normalizeCompanyName('АО «KASPI BANK»'), "kaspi bank");
  assert.equal(normalizeCompanyName("ИП Ёлкин"), "елкин");
  assert.equal(normalizeCompanyName("   "), "");
  assert.equal(normalizeCompanyName(null), "");
});

test("compareCompanyNames: точное совпадение после нормализации", () => {
  assert.equal(compareCompanyNames("Ромашка", 'ТОО "РОМАШКА"').verdict, "match");
  assert.equal(compareCompanyNames("ТОО Ромашка", 'ТОО "Ромашка"').verdict, "match");
  assert.equal(compareCompanyNames("Kaspi Bank", 'АО "KASPI BANK"').verdict, "match");
});

test("compareCompanyNames: подстрока → fuzzy", () => {
  const m = compareCompanyNames("Ромашка", 'ТОО "Ромашка Плюс"');
  assert.equal(m.verdict, "fuzzy");
});

test("compareCompanyNames: опечатка → fuzzy, разное → mismatch", () => {
  assert.equal(compareCompanyNames("Ромашка", 'ТОО "Ромашкa"').verdict, "fuzzy"); // 1 буква (лат. a)
  assert.equal(compareCompanyNames("Одуванчик", 'ТОО "Ромашка"').verdict, "mismatch");
});

test("compareCompanyNames: пустой вход → unknown", () => {
  assert.equal(compareCompanyNames("", 'ТОО "Ромашка"').verdict, "unknown");
  assert.equal(compareCompanyNames("Ромашка", null).verdict, "unknown");
});

test("isAlmatyCity: город да, область нет", () => {
  assert.equal(isAlmatyCity("Г.АЛМАТЫ"), true);
  assert.equal(isAlmatyCity("Алматы"), true);
  assert.equal(isAlmatyCity("Алматинская область"), false);
  assert.equal(isAlmatyCity("Астана"), false);
  assert.equal(isAlmatyCity(null), null);
});

test("buildBinVerdict: физлицо — не проверяется", () => {
  const v = buildBinVerdict({ customerType: "individual", enteredName: "Иван", record: null });
  assert.equal(v.checked, false);
  assert.match(v.summary, /Физлицо/);
});

test("buildBinVerdict: реестр не ответил (record=null) — мягко не проверено", () => {
  const v = buildBinVerdict({ customerType: "legal", enteredName: "Ромашка", record: null });
  assert.equal(v.checked, false);
  assert.equal(v.notFound, false);
  assert.equal(v.redFlags.length, 0);
});

test("buildBinVerdict: БИН не найден → красный флаг", () => {
  const v = buildBinVerdict({ customerType: "legal", enteredName: "Ромашка", record: record({ found: false }) });
  assert.equal(v.notFound, true);
  assert.ok(v.redFlags.some((f) => /не найден/.test(f)));
});

test("buildBinVerdict: чистое ТОО, имя совпало — без замечаний", () => {
  const v = buildBinVerdict({ customerType: "legal", enteredName: "Ромашка", record: record() });
  assert.equal(v.checked, true);
  assert.equal(v.nameMatch, "match");
  assert.deepEqual(v.redFlags, []);
  assert.equal(v.cityOutsideAlmaty, false);
  assert.match(v.summary, /Замечаний нет/);
});

test("buildBinVerdict: юрлицо, имя не совпало → флаг несовпадения", () => {
  const v = buildBinVerdict({ customerType: "legal", enteredName: "Одуванчик", record: record() });
  assert.equal(v.nameMatch, "mismatch");
  assert.ok(v.redFlags.some((f) => /не совпадает/.test(f)));
});

test("buildBinVerdict: ИП — несовпадение имени НЕ флаг", () => {
  const v = buildBinVerdict({
    customerType: "ip",
    enteredName: "Кафе Уют",
    record: record({ titleRu: "ИП ИВАНОВ ИВАН", cityName: "Г.АЛМАТЫ" }),
  });
  assert.equal(v.nameMatch, "mismatch");
  assert.equal(v.redFlags.length, 0); // для ИП сверка ненадёжна — не флагуем
});

test("buildBinVerdict: фрод-флаги (лжепредприятие, банкрот, долг) собираются", () => {
  const v = buildBinVerdict({
    customerType: "legal",
    enteredName: "Ромашка",
    record: record({
      status: "Бездействующий",
      flags: { fakeCompany: true, bankrupt: true, inactive: true, taxDebt: true, badGoszakup: true },
      debtTotal: 1500000,
    }),
  });
  assert.ok(v.redFlags.some((f) => /лжепредприятий/.test(f)));
  assert.ok(v.redFlags.some((f) => /банкрот/.test(f)));
  assert.ok(v.redFlags.some((f) => /недействующий/.test(f)));
  assert.ok(v.redFlags.some((f) => /задолженность/.test(f) && /1\s?500\s?000/.test(f.replace(/ /g, " "))));
  assert.ok(v.redFlags.some((f) => /госзакупок/.test(f)));
});

test("buildBinVerdict: адрес вне Алматы → жёлтый флаг", () => {
  const v = buildBinVerdict({
    customerType: "legal",
    enteredName: "Ромашка",
    record: record({ cityName: "Астана" }),
  });
  assert.equal(v.cityOutsideAlmaty, true);
  assert.ok(v.redFlags.some((f) => /вне Алматы/.test(f)));
});
