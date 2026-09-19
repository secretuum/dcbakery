import { strict as assert } from "node:assert";
import { test } from "node:test";
import robots from "@/app/robots";
import { LOCALES } from "@/src/i18n/config";
import { SITE_URL } from "@/src/lib/site-url";
import {
  WITHOUT_PUBLIC_METADATA,
  assertParsed,
  localizedPages,
  sampleRoute,
  unlocalizedRoutes,
} from "./page-sources";
import { isBlocked } from "./url-rules";

// robots.txt — единственный файл, ошибка в котором убирает сайт из выдачи целиком
// и молча: «Disallow: /» выглядит как одна лишняя строка, а последствия видны
// через месяц. app/robots.ts, в отличие от app/sitemap.ts, в тест-раннер грузится
// (из зависимостей только i18n/config и site-url), поэтому проверяем не исходник,
// а настоящий результат функции.

const result = robots();
const rules = [result.rules].flat();

function ruleFor(userAgent: string) {
  const rule = rules.find((r) => r.userAgent === userAgent);
  assert.ok(rule, `в robots.txt нет правила для «${userAgent}»`);
  return rule;
}

function disallowOf(userAgent: string): string[] {
  return [ruleFor(userAgent).disallow ?? []].flat();
}

const common = disallowOf("*");

test("индексация сайта разрешена", () => {
  assert.equal([ruleFor("*").allow ?? []].flat()[0], "/", "нет Allow: / для обычных роботов");
});

test("сайт не закрыт от индексации целиком", () => {
  // Ровно та строка, которая стоит сайту всей выдачи. Проверяем отдельно и вслух.
  for (const rule of rules) {
    const disallow = [rule.disallow ?? []].flat();
    assert.ok(
      !disallow.includes("/") && !disallow.includes(""),
      `«Disallow: /» для «${rule.userAgent}» закрывает от индексации ВЕСЬ сайт`,
    );
  }
});

test("карта сайта указана и лежит по каноническому адресу", () => {
  assert.equal(result.sitemap, `${SITE_URL}/sitemap.xml`);
});

test("канонический хост объявлен по https и без www", () => {
  const host = result.host;
  assert.ok(typeof host === "string" && host, "host в robots.txt не объявлен");
  assert.ok(host.startsWith("https://"), `host не по https: ${host}`);
  assert.ok(!host.includes("//www."), `host с www: ${host}`);
});

// --- Закрытые разделы --------------------------------------------------------

test("каждая служебная страница закрыта от обхода", () => {
  // Берём НАСТОЯЩИЕ маршруты из app/(unlocalized)/** — админку, страницы оплаты и
  // печатные документы (счета, накладные, АВР). Список не выписан руками нарочно:
  // новая страница админки попадает под проверку сама.
  const pages = unlocalizedRoutes();
  assertParsed(pages.length, 17, "служебных страниц");

  const open = pages
    .filter((page) => !isBlocked(sampleRoute(page.route), common))
    .map((page) => `${page.route} (${page.file})`);

  assert.deepEqual(
    open,
    [],
    `служебная страница открыта для обхода — в выдачу попадут админка, счета или ` +
      `страницы оплаты:\n  ${open.join("\n  ")}`,
  );
});

test("API закрыт от обхода", () => {
  // Отдельно от страниц: у ручек нет page.tsx, а отдавать их роботу незачем.
  // Сам адрес «/api» под «Disallow: /api/» не подпадает, но страницы там и нет —
  // проверяем то, что существует: вложенные ручки.
  for (const handler of ["/api/orders", "/api/payments/webhook", "/api/admin/login"]) {
    assert.ok(isBlocked(handler, common), `${handler} открыт для обхода`);
  }
});

test("транзакционные разделы закрыты во всех трёх языковых версиях", () => {
  // Живут внутри (main), то есть доступны по /kk/cart, /ru/cart, /en/cart. Закрыть
  // только «/cart» мало: три языковые версии — три разных адреса для робота.
  const open: string[] = [];

  for (const route of Object.keys(WITHOUT_PUBLIC_METADATA)) {
    if (route === "/register") continue; // закрыт своим robots:{index:false}, см. page-sources.ts
    for (const locale of LOCALES) {
      if (!isBlocked(`/${locale}${route}`, common)) open.push(`/${locale}${route}`);
    }
  }

  assert.deepEqual(open, [], `эти адреса открыты для обхода: ${open.join(", ")}`);
});

test("в выдачу не утечёт номер заказа", () => {
  // Отдельным тестом, потому что причина здесь не «нечего индексировать», а утечка:
  // адрес /order-success содержит номер заказа.
  for (const locale of LOCALES) {
    assert.ok(
      isBlocked(`/${locale}/order-success`, common),
      `/${locale}/order-success открыт: номер заказа может попасть в выдачу`,
    );
  }
});

test("публичные страницы под запрет случайно не попали", () => {
  // Обратная сторона: слишком широкая запись («/c» вместо «/cart») закрыла бы
  // заодно и каталог. Проверяем каждый публичный маршрут во всех локалях.
  const blocked: string[] = [];

  for (const page of localizedPages()) {
    if (page.route in WITHOUT_PUBLIC_METADATA) continue;
    const route = sampleRoute(page.route);
    for (const locale of LOCALES) {
      const url = `/${locale}${route === "/" ? "" : route}`;
      if (isBlocked(url, common)) blocked.push(url);
    }
  }

  assert.deepEqual(
    blocked,
    [],
    `публичная страница закрыта от индексации — запись в DISALLOW слишком широкая: ${blocked.join(", ")}`,
  );
});

// --- ИИ-краулеры -------------------------------------------------------------

test("ИИ-краулеры перечислены поимённо и пускаются наравне с поисковиками", () => {
  // Решение владельца: контент открыт для обучения и ИИ-выдачи. Отдельные правила
  // для каждого бота — сигнал явного разрешения; для Google-Extended это условие
  // попадания в ИИ-функции выдачи Google. Сторож на случай «почистили список».
  const named = rules.flatMap((rule) => [rule.userAgent ?? []].flat()).filter((a) => a !== "*");

  assert.ok(named.length >= 16, `ИИ-краулеров в robots.txt осталось ${named.length} из 16+`);
  for (const required of ["GPTBot", "Google-Extended", "ClaudeBot", "PerplexityBot"]) {
    assert.ok(named.includes(required), `${required} пропал из robots.txt`);
  }
});

test("у каждого названного бота те же права, что у обычного робота", () => {
  // Разъехавшиеся списки — тихая беда: бот получит запрет там, где у всех разрешено.
  for (const rule of rules) {
    assert.equal([rule.allow ?? []].flat()[0], "/", `у «${rule.userAgent}» нет Allow: /`);
    assert.deepEqual(
      [rule.disallow ?? []].flat(),
      common,
      `список закрытых разделов у «${rule.userAgent}» разошёлся с общим`,
    );
  }
});
