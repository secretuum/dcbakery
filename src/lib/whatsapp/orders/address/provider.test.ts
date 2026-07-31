import { test } from "node:test";
import assert from "node:assert/strict";
import { AlmatyHeuristicAddressProvider } from "./provider";

const provider = new AlmatyHeuristicAddressProvider();

test("адрес в Алматы → in_almaty", async () => {
  const r = await provider.validate("г. Алматы, ул. Жамбыла 154");
  assert.equal(r.status, "in_almaty");
  assert.equal(r.matchedCity, "алматы");
});

test("микрорайон Алматы → in_almaty", async () => {
  const r = await provider.validate("мкр Самал-2, дом 33");
  assert.equal(r.status, "in_almaty");
});

test("другой город → outside_almaty", async () => {
  const r = await provider.validate("Астана, пр. Кабанбай батыра 1");
  assert.equal(r.status, "outside_almaty");
  assert.equal(r.matchedCity, "астана");

  const r2 = await provider.validate("Шымкент, ул. Тауке хана 5");
  assert.equal(r2.status, "outside_almaty");
});

test("адрес без города → uncertain (не угадываем)", async () => {
  const r = await provider.validate("ул. Абая 10, кв 5");
  assert.equal(r.status, "uncertain");
});

test("мусор/слишком короткий → uncertain", async () => {
  assert.equal((await provider.validate("")).status, "uncertain");
  assert.equal((await provider.validate("...")).status, "uncertain");
});
