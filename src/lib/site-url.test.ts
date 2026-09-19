import { test } from "node:test";
import assert from "node:assert/strict";
import { normalizeSiteUrl, SITE_URL } from "@/src/lib/site-url";

const CANONICAL = "https://dc-bakery.kz";

// SITE_URL раздаётся в canonical, hreflang, og:url, карту сайта и robots. Любое
// отклонение хоста или схемы от канонического — это второй сайт в глазах поиска
// и раздвоенные страницы в индексе. Переменную задаёт человек в панели хостинга,
// поэтому «сейчас она задана верно» защитой не является.

test("http поднимается до https", () => {
  assert.equal(normalizeSiteUrl("http://dc-bakery.kz"), CANONICAL);
  assert.equal(normalizeSiteUrl("http://dc-bakery.kz/"), CANONICAL);
});

test("ведущий www снимается", () => {
  assert.equal(normalizeSiteUrl("https://www.dc-bakery.kz"), CANONICAL);
  // Обе болезни разом — типичное значение, скопированное из адресной строки.
  assert.equal(normalizeSiteUrl("http://www.dc-bakery.kz"), CANONICAL);
});

test("канонический адрес не меняется", () => {
  assert.equal(normalizeSiteUrl(CANONICAL), CANONICAL);
});

test("хвостовой слэш срезается", () => {
  // Иначе склейка `${SITE_URL}/${locale}` даст «https://dc-bakery.kz//ru».
  assert.equal(normalizeSiteUrl("https://dc-bakery.kz/"), CANONICAL);
  assert.equal(normalizeSiteUrl("https://dc-bakery.kz///"), CANONICAL);
});

test("значение без схемы получает https", () => {
  assert.equal(normalizeSiteUrl("dc-bakery.kz"), CANONICAL);
  assert.equal(normalizeSiteUrl("www.dc-bakery.kz"), CANONICAL);
});

test("мусор откатывается на дефолт, а не роняет сборку", () => {
  // Слипшееся в .env значение с пробелом внутри — реальный случай, ради которого
  // откат и заведён: без него new URL(SITE_URL) в метаданных валит весь сайт.
  assert.equal(normalizeSiteUrl("https://dc bakery.kz"), CANONICAL);
  assert.equal(normalizeSiteUrl("не адрес вовсе"), CANONICAL);
  assert.equal(normalizeSiteUrl(""), CANONICAL);
  assert.equal(normalizeSiteUrl("   "), CANONICAL);
});

test("регистр схемы и хоста значения не имеет", () => {
  assert.equal(normalizeSiteUrl("HTTP://WWW.DC-BAKERY.KZ"), CANONICAL);
});

test("www снимается только ведущий, внутри хоста — не трогаем", () => {
  // «wwwx.» и поддомен, начинающийся не с www, — чужие адреса, но резать у них
  // ничего нельзя: обрезка вслепую превратила бы их в несуществующий хост.
  assert.equal(normalizeSiteUrl("https://wwwx.dc-bakery.kz"), "https://wwwx.dc-bakery.kz");
  assert.equal(normalizeSiteUrl("https://shop.www.dc-bakery.kz"), "https://shop.www.dc-bakery.kz");
});

test("путь и порт в значении сохраняются", () => {
  // Сайт может жить не в корне домена и не на 443 порту — нормализация правит
  // схему и www, а не выкидывает всё остальное.
  assert.equal(normalizeSiteUrl("https://dc-bakery.kz/shop"), "https://dc-bakery.kz/shop");
  assert.equal(normalizeSiteUrl("https://dc-bakery.kz:8443"), "https://dc-bakery.kz:8443");
});

test("итоговый SITE_URL канонический", () => {
  // Сторожевая проверка самого значения, с которым работает сайт прямо сейчас.
  assert.ok(SITE_URL.startsWith("https://"), `SITE_URL не по https: ${SITE_URL}`);
  assert.ok(!new URL(SITE_URL).host.startsWith("www."), `SITE_URL с www: ${SITE_URL}`);
  assert.ok(!SITE_URL.endsWith("/"), `SITE_URL с хвостовым слэшем: ${SITE_URL}`);
});
