import { test } from "node:test";
import assert from "node:assert/strict";
import { parsePrgAppCompany } from "./company-registry-parse";

// Фикстуры повторяют реальную форму ответа apiba.prgapp.kz/CompanyFullInfo
// (проверено вживую на БИН 971240001315 и фейке 000000000000).

const CLEAN_TOO = {
  basicInfo: {
    isDeleted: false,
    isIndividual: false,
    titleRu: { value: 'ТОО "РОМАШКА"' },
    titleKz: { value: '"РОМАШКА" ЖШС' },
    status: { value: { value: 0, description: "Активен" } },
    ceo: { value: { title: "ИВАНОВ ИВАН" } },
    addressRu: { value: "г. Алматы, ул. Абая, 1" },
    cityName: "Г.АЛМАТЫ",
    primaryOKED: { value: "56101 Рестораны" },
  },
  debtsInfo: { kgd: { totalDebt: 0, totalFine: 0 } },
  reestrs: [
    { violation: 4, isIntruder: false, description: "лжепредприятия" },
    { violation: 3, isIntruder: false, description: "банкротами" },
    { isIntruder: false, description: "Недобросовестный участник ГЗ" },
  ],
};

test("parse: чистое активное ТОО в Алматы", () => {
  const r = parsePrgAppCompany(CLEAN_TOO);
  assert.equal(r.found, true);
  assert.equal(r.isIndividual, false);
  assert.equal(r.titleRu, 'ТОО "РОМАШКА"');
  assert.equal(r.status, "Активен"); // двойная обёртка status.value.description
  assert.equal(r.cityName, "Г.АЛМАТЫ");
  assert.equal(r.ceo, "ИВАНОВ ИВАН");
  assert.equal(r.debtTotal, 0);
  assert.deepEqual(r.flags, {
    fakeCompany: false, bankrupt: false, inactive: false, taxDebt: false, badGoszakup: false,
  });
});

test("parse: фрод — лжепредприятие + банкрот + долг + госзакуп + бездействующий", () => {
  const r = parsePrgAppCompany({
    basicInfo: {
      isDeleted: false,
      isIndividual: false,
      titleRu: { value: 'ТОО "ФИРМА"' },
      status: { value: { value: 3, description: "Бездействующий" } },
      cityName: "Г.АЛМАТЫ",
    },
    debtsInfo: { kgd: { totalDebt: 1000000, totalFine: 500000 } },
    reestrs: [
      { violation: 4, isIntruder: true, description: "лжепредприятия" },
      { violation: 3, isIntruder: true, description: "банкротами" },
      { violation: 2, isIntruder: true, description: "налоговая задолженность" },
      { isIntruder: true, description: "Недобросовестный участник ГЗ" },
    ],
  });
  assert.equal(r.found, true);
  assert.equal(r.debtTotal, 1500000);
  assert.deepEqual(r.flags, {
    fakeCompany: true, bankrupt: true, inactive: true, taxDebt: true, badGoszakup: true,
  });
});

test("parse: БИН не найден (titleRu.value=null, isDeleted=true)", () => {
  const r = parsePrgAppCompany({
    basicInfo: {
      isDeleted: true,
      isIndividual: true,
      titleRu: { value: null },
      titleKz: { value: null },
      status: { value: null },
    },
    reestrs: [],
  });
  assert.equal(r.found, false);
  assert.equal(r.titleRu, null);
});

test("parse: ИП (isIndividual=true)", () => {
  const r = parsePrgAppCompany({
    basicInfo: {
      isDeleted: false,
      isIndividual: true,
      titleRu: { value: "ИП ПЕТРОВ ПЕТР" },
      status: { value: { value: 0, description: "Активен" } },
      cityName: "Г.АЛМАТЫ",
    },
    reestrs: [],
  });
  assert.equal(r.found, true);
  assert.equal(r.isIndividual, true);
  assert.equal(r.titleRu, "ИП ПЕТРОВ ПЕТР");
});

test("parse: мусор на входе не роняет (null/пустой объект)", () => {
  assert.equal(parsePrgAppCompany(null).found, false);
  assert.equal(parsePrgAppCompany({}).found, false);
  assert.deepEqual(parsePrgAppCompany({}).flags, {
    fakeCompany: false, bankrupt: false, inactive: false, taxDebt: false, badGoszakup: false,
  });
});

test("parse: город из crumbsKato, если cityName пуст", () => {
  const r = parsePrgAppCompany({
    basicInfo: {
      titleRu: { value: "ТОО X" },
      status: { value: { description: "Активен" } },
      crumbsKato: { nameRu: "Алматы" },
    },
  });
  assert.equal(r.cityName, "Алматы");
});
