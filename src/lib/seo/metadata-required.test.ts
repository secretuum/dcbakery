import { strict as assert } from "node:assert";
import { test } from "node:test";
import robots from "@/app/robots";
import { buildPageMetadata } from "@/src/components/seo/page-metadata";
import { HREFLANG, LOCALES, DEFAULT_LOCALE } from "@/src/i18n/config";
import { SITE_URL } from "@/src/lib/site-url";
import {
  WITHOUT_PUBLIC_METADATA,
  assertParsed,
  hasGenerateMetadata,
  hasNoIndex,
  localizedPages,
  metadataRoute,
  routePattern,
  sampleRoute,
  type Locale,
} from "./page-sources";
import { isBlocked } from "./url-rules";

// Сам сборщик buildPageMetadata покрыт (src/components/seo/page-metadata.test.ts):
// canonical равен og:url, hreflang перечисляет три локали и x-default. Дыра была в
// другом: НИКТО не проверял, что страница этот сборщик вообще зовёт. Забыть вызов
// на новой странице — и все тесты зелёные, а страница уезжает в выдачу без canonical
// и с og:url родительского layout, то есть указывающим на корень локали.
//
// Поэтому здесь два разных сторожа:
//  1) разбор исходников app/**/page.tsx — «каждая публичная страница экспортирует
//     generateMetadata и строит его через buildPageMetadata», поимённо по файлам;
//  2) прогон настоящего сборщика по маршрутам этих страниц — canonical, три
//     hreflang, x-default и собственный og:url действительно появляются.

const pages = localizedPages();

/** Список запретов для обычного поискового робота — берём из настоящего robots.txt. */
const commonDisallow = (() => {
  const common = [robots().rules].flat().find((rule) => rule.userAgent === "*");
  assert.ok(common, "в app/robots.ts нет правила для userAgent '*'");
  return [common.disallow ?? []].flat();
})();

const publicPages = pages.filter((page) => !(page.route in WITHOUT_PUBLIC_METADATA));

test("страницы сайта найдены (разбор не разъехался с кодом)", () => {
  assertParsed(pages.length, 13, "локализованных страниц");
  assertParsed(publicPages.length, 7, "публичных страниц");
});

test("каждая публичная страница экспортирует generateMetadata", () => {
  const without = publicPages.filter((page) => !hasGenerateMetadata(page.source)).map((p) => p.file);

  assert.deepEqual(
    without,
    [],
    "страница без generateMetadata уйдёт в выдачу с общесайтовым заголовком из layout. " +
      "Если она служебная — впишите её в WITHOUT_PUBLIC_METADATA (src/lib/seo/page-sources.ts) " +
      `с причиной и закройте от индексации. Файлы: ${without.join(", ")}`,
  );
});

test("каждая публичная страница строит метаданные через buildPageMetadata", () => {
  // Вызов сборщика — это одновременно canonical, hreflang, x-default, og:url,
  // og:locale и twitter-карточка. Нет вызова — нет ничего из перечисленного.
  const without = publicPages.filter((page) => !metadataRoute(page.source)).map((p) => p.file);

  assert.deepEqual(
    without,
    [],
    "страница не зовёт buildPageMetadata: у неё не будет ни canonical, ни hreflang, " +
      "а og:url укажет на корень локали вместо самой страницы. " +
      `Файлы: ${without.join(", ")}`,
  );
});

test("путь, переданный сборщику, совпадает с настоящим маршрутом страницы", () => {
  // Скопировали страницу вместе с вызовом и забыли поправить path — canonical
  // новой страницы укажет на старую, и в выдаче останется одна из двух.
  const wrong = publicPages
    .map((page) => ({ page, declared: metadataRoute(page.source) }))
    .filter(({ page, declared }) => declared && declared !== routePattern(page.route))
    .map(({ page, declared }) => `${page.file}: path ${declared}, а маршрут ${page.route}`);

  assert.deepEqual(wrong, [], `canonical укажет не на ту страницу:\n  ${wrong.join("\n  ")}`);
});

test("страницы без метаданных действительно закрыты от индексации", () => {
  // Список исключений не должен стать свалкой «тут просто забыли». Раз страница
  // объявлена служебной — пусть она будет закрыта в robots.txt или сама скажет
  // robots:{index:false}. Иначе это не исключение, а необнаруженная дыра.
  const open: string[] = [];

  for (const [route, reason] of Object.entries(WITHOUT_PUBLIC_METADATA)) {
    const page = pages.find((p) => p.route === route);
    assert.ok(page, `в WITHOUT_PUBLIC_METADATA числится ${route}, а страницы такой нет`);

    const closedInRobots = LOCALES.every((locale) =>
      isBlocked(`/${locale}${route}`, commonDisallow),
    );
    if (!closedInRobots && !hasNoIndex(page.source)) {
      open.push(`${route} (${reason})`);
    }
  }

  assert.deepEqual(
    open,
    [],
    "страница объявлена служебной, но от индексации не закрыта — ни в app/robots.ts, " +
      `ни через robots:{index:false}:\n  ${open.join("\n  ")}`,
  );
});

test("в списке исключений нет страниц, которых больше нет", () => {
  const stale = Object.keys(WITHOUT_PUBLIC_METADATA).filter(
    (route) => !pages.some((page) => page.route === route),
  );

  assert.deepEqual(stale, [], `исключение есть, а страницы нет: ${stale.join(", ")}`);
});

// --- Что именно получает каждая публичная страница ---------------------------

for (const page of publicPages) {
  const route = sampleRoute(page.route);

  for (const locale of LOCALES as readonly Locale[]) {
    test(`${page.route} [${locale}]: canonical, hreflang на три языка и x-default`, () => {
      const meta = buildPageMetadata({
        path: route,
        locale,
        title: "Заголовок",
        description: "Описание",
      });
      const alternates = meta.alternates as {
        canonical?: string;
        languages?: Record<string, string>;
      };

      const expected = `${SITE_URL}/${locale}${route === "/" ? "" : route}`;
      assert.equal(alternates?.canonical, expected, "canonical не ведёт на саму страницу");

      const languages = alternates?.languages ?? {};
      for (const other of LOCALES) {
        assert.equal(
          languages[HREFLANG[other]],
          `${SITE_URL}/${other}${route === "/" ? "" : route}`,
          `нет hreflang="${HREFLANG[other]}" — версия на этом языке не будет связана с остальными`,
        );
      }
      assert.equal(
        languages["x-default"],
        `${SITE_URL}/${DEFAULT_LOCALE}${route === "/" ? "" : route}`,
        "нет hreflang=\"x-default\" — поиску нечего показать пользователю с другим языком",
      );
    });

    test(`${page.route} [${locale}]: openGraph со своим og:url`, () => {
      const meta = buildPageMetadata({
        path: route,
        locale,
        title: "Заголовок",
        description: "Описание",
      });
      const og = meta.openGraph as Record<string, unknown> | undefined;

      assert.ok(og, "openGraph не собран — ссылка в мессенджере покажет текст из layout");
      assert.equal(
        og.url,
        `${SITE_URL}/${locale}${route === "/" ? "" : route}`,
        "og:url ведёт не на саму страницу: ссылка на раздел выглядит как ссылка на главную",
      );
      assert.equal(og.title, "Заголовок", "og:title не свой");
      assert.equal(og.description, "Описание", "og:description не своё");
      assert.ok(
        Array.isArray(og.images) && og.images.length > 0,
        "og:image не задан — превью ссылки будет пустым",
      );
    });
  }
}
