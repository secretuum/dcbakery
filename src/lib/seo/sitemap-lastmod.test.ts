import { strict as assert } from "node:assert";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import path from "node:path";

// Страж таблицы STATIC_LAST_MODIFIED в app/sitemap.ts: добавили в карту сайта
// новый статический маршрут и забыли завести ему дату — этот тест падает.
// Без него страница молча уедет в выдачу без lastmod, и заметят это нескоро.
//
// Тест разбирает ИСХОДНИК, а не импортирует app/sitemap.ts: тот тянет за собой
// src/lib/catalog -> supabase -> next/cache, который в тест-раннере не работает.

const source = readFileSync(path.join(process.cwd(), "app/sitemap.ts"), "utf8");

/** Маршруты, объявленные в карте через staticPage("/…"). */
const declaredRoutes = [...source.matchAll(/staticPage\(\s*"([^"]+)"/g)].map((m) => m[1]);

/** Ключи таблицы дат. */
const datedRoutes = (() => {
  const block = /const STATIC_LAST_MODIFIED: Record<string, string> = \{([^}]*)\}/.exec(source);
  assert.ok(block, "таблица STATIC_LAST_MODIFIED не найдена — тест разъехался с кодом");
  return new Map([...block[1].matchAll(/"([^"]+)":\s*"([^"]+)"/g)].map((m) => [m[1], m[2]]));
})();

test("статические маршруты карты сайта вообще найдены", () => {
  assert.ok(declaredRoutes.length >= 7, `найдено маршрутов: ${declaredRoutes.length}`);
});

test("у каждого статического маршрута есть дата", () => {
  const orphans = declaredRoutes.filter((route) => !datedRoutes.has(route));
  assert.deepEqual(
    orphans,
    [],
    `маршрут есть в карте, а даты в STATIC_LAST_MODIFIED нет: ${orphans.join(", ")}`,
  );
});

test("в таблице дат нет записей для несуществующих маршрутов", () => {
  const stale = [...datedRoutes.keys()].filter((route) => !declaredRoutes.includes(route));
  assert.deepEqual(stale, [], `дата есть, а маршрута в карте нет: ${stale.join(", ")}`);
});

test("даты записаны как ГГГГ-ММ-ДД и не из будущего", () => {
  for (const [route, value] of datedRoutes) {
    assert.match(value, /^\d{4}-\d{2}-\d{2}$/, `${route}: дата не в формате ГГГГ-ММ-ДД: ${value}`);

    const parsed = Date.parse(value);
    assert.ok(!Number.isNaN(parsed), `${route}: дата не разбирается: ${value}`);
    // Дата из будущего — верный признак опечатки в годе.
    assert.ok(parsed <= Date.now(), `${route}: дата из будущего: ${value}`);
  }
});
