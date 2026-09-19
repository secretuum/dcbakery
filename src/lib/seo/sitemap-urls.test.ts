import { strict as assert } from "node:assert";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import path from "node:path";
import robots from "@/app/robots";
import { LOCALES } from "@/src/i18n/config";
import { SITE_URL } from "@/src/lib/site-url";
import {
  WITHOUT_PUBLIC_METADATA,
  assertParsed,
  localizedPages,
  routePattern,
} from "./page-sources";
import { isBlocked, lastmodProblem, sitemapUrlProblem } from "./url-rules";

// Карта сайта — то, по чему поиск обходит сайт. Три беды, которые она приносит
// молча: адрес по http или с www (страница раздваивается с canonical), адрес
// закрытого в robots раздела (противоречивые сигналы разбираются не в нашу
// пользу) и запись без lastmod (робот не знает, что страница обновилась).
//
// app/sitemap.ts в тест-раннер не грузится — тянет catalog -> supabase -> next/cache,
// поэтому маршруты берём разбором исходника (так же поступает соседний
// sitemap-lastmod.test.ts, который сторожит таблицу дат). Сами ПРАВИЛА адресов
// живут в чистом хелпере src/lib/seo/url-rules.ts и проверены ниже отдельно —
// на подсунутых плохих адресах, которых в живой карте, к счастью, нет.

const source = readFileSync(path.join(process.cwd(), "app/sitemap.ts"), "utf8");

/** Статические маршруты карты: staticPage("/catalog"). */
const staticRoutes = [...source.matchAll(/staticPage\(\s*"([^"]+)"/g)].map((m) => m[1]);

/** Маршруты на данных: localized(`/product/${product.slug}`) -> "/product/[*]". */
const dynamicRoutes = [...source.matchAll(/localized\(\s*`([^`]+)`/g)].map((m) =>
  m[1].replace(/\$\{[^}]*\}/g, "[*]"),
);

const commonRule = [robots().rules].flat().find((rule) => rule.userAgent === "*");
const disallow = [commonRule?.disallow ?? []].flat();
const canonicalHost = new URL(SITE_URL).host;

test("маршруты карты сайта разобраны (разбор не разъехался с кодом)", () => {
  assertParsed(staticRoutes.length, 7, "статических маршрутов карты");
  assertParsed(dynamicRoutes.length, 2, "маршрутов карты на данных");
});

// --- Адреса ------------------------------------------------------------------

/** Все адреса, которые карта отдаёт: каждый маршрут × три локали. */
const urls = [...staticRoutes, ...dynamicRoutes].flatMap((route) => {
  const clean = route === "/" ? "" : route.replace(/\[\*\]/g, "obrazets");
  return LOCALES.map((locale) => ({ route, url: `${SITE_URL}/${locale}${clean}` }));
});

test("все адреса карты сайта — по https, без www и не из закрытых разделов", () => {
  const problems = urls
    .map(({ route, url }) => ({
      url,
      route,
      problem: sitemapUrlProblem(url, disallow, canonicalHost),
    }))
    .filter((entry) => entry.problem)
    .map((entry) => `${entry.url} (маршрут ${entry.route}): ${entry.problem}`);

  assert.deepEqual(problems, [], `негодные адреса в карте сайта:\n  ${problems.join("\n  ")}`);
});

test("карта сайта не зовёт робота туда, откуда его гонит robots.txt", () => {
  // Отдельно от общей проверки выше: это самая тихая из ошибок — страница
  // остаётся в карте после того, как раздел закрыли в robots.
  const conflicting = urls
    .filter(({ url }) => isBlocked(new URL(url).pathname, disallow))
    .map(({ url }) => url);

  assert.deepEqual(
    conflicting,
    [],
    `эти адреса закрыты в robots.txt, но карта сайта их предлагает: ${conflicting.join(", ")}`,
  );
});

test("адреса собираются из SITE_URL, а не вписаны руками", () => {
  // Литерал домена в карте переживёт смену адреса сайта и будет тихо уводить
  // робота на старый хост.
  const body = source.replace(/^\s*\/\/.*$/gm, "");

  assert.ok(!/http:\/\//.test(body), "в app/sitemap.ts есть адрес по http://");
  assert.ok(!/\bwww\./.test(body), "в app/sitemap.ts есть адрес с www");
  assert.ok(
    !/https:\/\/(?!schema\.org)/.test(body),
    "в app/sitemap.ts вписан домен литералом — адреса должны строиться из SITE_URL",
  );
});

test("канонический адрес сайта сам проходит правила карты", () => {
  assert.equal(
    sitemapUrlProblem(`${SITE_URL}/kk/catalog`, disallow, canonicalHost),
    undefined,
    `SITE_URL (${SITE_URL}) не годится для карты сайта`,
  );
});

// --- Полнота -----------------------------------------------------------------

test("каждая публичная страница попала в карту сайта", () => {
  // Обратная проверка к robots: страница открыта для индексации, но робот о ней
  // не узнает, пока не набредёт по ссылке.
  const covered = new Set([...staticRoutes, ...dynamicRoutes]);
  const missing = localizedPages()
    .filter((page) => !(page.route in WITHOUT_PUBLIC_METADATA))
    .filter((page) => !covered.has(routePattern(page.route)))
    .map((page) => `${page.route} (${page.file})`);

  assert.deepEqual(
    missing,
    [],
    `публичная страница есть, а в карте сайта её нет:\n  ${missing.join("\n  ")}`,
  );
});

test("в карте сайта нет маршрутов, которых на сайте не осталось", () => {
  const routes = new Set(
    localizedPages()
      .filter((page) => !(page.route in WITHOUT_PUBLIC_METADATA))
      .map((page) => routePattern(page.route)),
  );
  const stale = [...staticRoutes, ...dynamicRoutes].filter((route) => !routes.has(route));

  assert.deepEqual(stale, [], `карта ведёт на несуществующие страницы: ${stale.join(", ")}`);
});

// --- lastmod -----------------------------------------------------------------
//
// Даты СТАТИЧЕСКИХ страниц сторожит sitemap-lastmod.test.ts (таблица заполнена,
// формат, не из будущего) — здесь их не дублируем. Не покрыто было другое:
// записи разделов и товаров берут дату из данных, и её легко «починить»
// подстановкой сегодняшнего числа.

test("карта сайта не выдумывает дату обновления", () => {
  // lastModified: new Date() на каждой записи — худший из вариантов: поисковик
  // видит, что «весь сайт обновился» при каждом деплое, перестаёт верить полю и
  // игнорирует его целиком. Лучше вовсе без даты.
  const body = source.replace(/^\s*\/\/.*$/gm, "");

  assert.ok(!/Date\.now\(\)/.test(body), "в карте сайта дата берётся из Date.now()");
  assert.ok(!/new Date\(\)/.test(body), "в карте сайта дата берётся из new Date()");
});

test("дата раздела и товара берётся из данных", () => {
  const body = source.replace(/^\s*\/\/.*$/gm, "");

  assert.match(
    body,
    /lastModified: product\.updated_at/,
    "карточка товара перестала отдавать дату из product.updated_at",
  );
  assert.match(
    body,
    /categoryLastModified\(products\)/,
    "раздел каталога перестал брать дату по самому свежему товару",
  );
});

// --- Сами правила ------------------------------------------------------------
//
// В живой карте плохих адресов нет — и хорошо. Но сторож, который никогда не
// видел плохого адреса, ничего не доказывает: проверяем правила на подсунутых.
//
// Хост здесь свой, выдуманный, а не SITE_URL: правило — чистая функция, и её
// проверка не должна зависеть от того, что записано в переменных окружения.

const HOST = "dc-bakery.test";
const BLOCKED = [
  "/kk/cart",
  "/ru/checkout",
  "/en/profile",
  "/kk/order-success",
  "/admin/orders",
  "/documents/invoice/42",
];

test("правило пропускает годный адрес", () => {
  assert.equal(sitemapUrlProblem(`https://${HOST}/kk/catalog`, disallow, HOST), undefined);
});

test("правило отсекает адрес по http", () => {
  assert.match(sitemapUrlProblem(`http://${HOST}/kk/catalog`, disallow, HOST) ?? "", /https/);
});

test("правило отсекает адрес с www", () => {
  assert.match(sitemapUrlProblem(`https://www.${HOST}/kk/catalog`, disallow, HOST) ?? "", /www/);
});

test("правило отсекает закрытые разделы", () => {
  for (const blocked of BLOCKED) {
    assert.match(
      sitemapUrlProblem(`https://${HOST}${blocked}`, disallow, HOST) ?? "",
      /robots/,
      `${blocked} проскочил в карту сайта`,
    );
  }
});

test("правило отсекает чужой хост и мусор вместо адреса", () => {
  assert.match(sitemapUrlProblem(`https://dc-bakery.example/kk`, disallow, HOST) ?? "", /хост/);
  assert.match(sitemapUrlProblem("/kk/catalog", disallow, HOST) ?? "", /не разбирается/);
});

test("правило lastmod отсекает пустое, кривое и будущее", () => {
  assert.equal(lastmodProblem("2026-09-18"), undefined);
  assert.equal(lastmodProblem("2026-09-18T10:00:00Z"), undefined);
  assert.match(lastmodProblem("") ?? "", /пуст/);
  assert.match(lastmodProblem(undefined) ?? "", /пуст/);
  assert.match(lastmodProblem("18.09.2026") ?? "", /формате/);
  assert.match(lastmodProblem("2099-01-01") ?? "", /будущего/);
});
