import { test } from "node:test";
import assert from "node:assert/strict";
import { build2gisPointLink, build2gisSearchLink, isValidLatLng } from "./gis";

test("isValidLatLng: диапазоны и (0,0)", () => {
  assert.equal(isValidLatLng(43.238, 76.945), true); // Алматы
  assert.equal(isValidLatLng(0, 0), false); // «пустые» координаты
  assert.equal(isValidLatLng(91, 76), false); // широта вне диапазона
  assert.equal(isValidLatLng(43, 181), false); // долгота вне диапазона
  assert.equal(isValidLatLng("abc", 76), false);
});

test("build2gisPointLink: порядок lon,lat + округление", () => {
  assert.equal(build2gisPointLink(43.2380001, 76.9450009), "https://2gis.kz/almaty/geo/76.945001,43.238");
  assert.equal(build2gisPointLink(0, 0), null);
  assert.equal(build2gisPointLink(200, 76), null);
});

test("build2gisSearchLink: кодирование, короткие/ссылочные — null", () => {
  assert.equal(build2gisSearchLink("Абая 10"), "https://2gis.kz/almaty/search/%D0%90%D0%B1%D0%B0%D1%8F%2010");
  assert.equal(build2gisSearchLink("  "), null);
  assert.equal(build2gisSearchLink("ok"), null); // слишком коротко
  assert.equal(build2gisSearchLink("https://2gis.kz/almaty/geo/76,43"), null); // уже ссылка
});
