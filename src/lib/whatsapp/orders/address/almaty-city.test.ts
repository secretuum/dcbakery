import { test } from "node:test";
import assert from "node:assert/strict";
import { classifyGeocode, combineAddressVerdict, type GeocodeHit } from "./almaty-city";
import type { AddressValidationResult } from "./provider";

function hit(verdict: GeocodeHit["verdict"], city: string | null = "Алматы"): GeocodeHit {
  return { lat: 43.238, lon: 76.945, city, countryCode: "KZ", verdict };
}

test("classifyGeocode: город Алматы → almaty", () => {
  assert.equal(classifyGeocode("Алматы", "KZ"), "almaty");
  assert.equal(classifyGeocode("Almaty", "kz"), "almaty");
});

test("classifyGeocode: Алматинская ОБЛАСТЬ → other (не город)", () => {
  assert.equal(classifyGeocode("Алматинская область", "KZ"), "other");
  assert.equal(classifyGeocode("Almaty Region", "KZ"), "other");
});

test("classifyGeocode: другой город/страна → other", () => {
  assert.equal(classifyGeocode("Астана", "KZ"), "other");
  assert.equal(classifyGeocode("Талгар", "KZ"), "other");
  assert.equal(classifyGeocode("Москва", "RU"), "other"); // другая страна
});

test("classifyGeocode: город не определён → unknown (без ложного отказа)", () => {
  assert.equal(classifyGeocode(null, "KZ"), "unknown");
  assert.equal(classifyGeocode("", null), "unknown");
});

const IN_ALMATY: AddressValidationResult = { status: "in_almaty", normalized: "алматы абая 10", matchedCity: "алматы", reason: "almaty_marker" };
const OUTSIDE: AddressValidationResult = { status: "outside_almaty", normalized: "астана", matchedCity: "астана", reason: "other_city" };
const UNCERTAIN: AddressValidationResult = { status: "uncertain", normalized: "абая 10", reason: "no_city_marker" };
const SHORT: AddressValidationResult = { status: "uncertain", normalized: "аб", reason: "too_short_or_empty" };

test("combine: явный in_almaty НЕ опрокидываем, только координаты", () => {
  const r = combineAddressVerdict(IN_ALMATY, hit("other", "Астана"));
  assert.equal(r.status, "in_almaty"); // эвристика уверена — геокодер не опрокидывает
  assert.equal(r.lat, 43.238);
});

test("combine: явный outside НЕ трогаем; мусорный ввод и отсутствие хита → база", () => {
  assert.equal(combineAddressVerdict(OUTSIDE, hit("almaty")).status, "outside_almaty");
  assert.equal(combineAddressVerdict(SHORT, hit("almaty")).status, "uncertain");
  assert.equal(combineAddressVerdict(UNCERTAIN, null).status, "uncertain");
});

test("combine: неоднозначный адрес решает геокодер", () => {
  assert.equal(combineAddressVerdict(UNCERTAIN, hit("other", "Талгар")).status, "outside_almaty");
  const almaty = combineAddressVerdict(UNCERTAIN, hit("almaty"));
  assert.equal(almaty.status, "in_almaty");
  assert.equal(almaty.lon, 76.945);
  assert.equal(combineAddressVerdict(UNCERTAIN, hit("unknown", null)).status, "uncertain"); // не определил → менеджеру
});
