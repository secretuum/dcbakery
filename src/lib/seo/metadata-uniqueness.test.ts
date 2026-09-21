import { strict as assert } from "node:assert";
import { test } from "node:test";
import {
  CATEGORY_ROUTE,
  DATA_DRIVEN_TITLES,
  LOCALES,
  WITHOUT_PUBLIC_METADATA,
  assertParsed,
  brandSuffix,
  categoryPageTexts,
  descriptionKey,
  localizedPages,
  readsCategoryTexts,
  titleKey,
  translate,
  type Locale,
} from "./page-sources";

// Одинаковый <title> или <meta name="description"> на двух страницах — классическая
// причина, по которой одна из них выпадает из выдачи: поиск считает страницы
// дублями и оставляет «лучшую». Длину мы уже меряем (metadata-length.test.ts),
// а вот уникальность до сих пор не проверял никто.
//
// Проверяем В ПРЕДЕЛАХ ЛОКАЛИ и отдельно для каждой из трёх. Мало того что тексты
// должны различаться по-русски — два РАЗНЫХ русских заголовка легко схлопываются
// в один казахский или английский, если переводчик поленился. Такой дубль в
// исходнике не виден вообще, а в kk-выдаче он настоящий.

const publicPages = localizedPages().filter((page) => !(page.route in WITHOUT_PUBLIC_METADATA));

type TextPage = {
  file: string;
  route: string;
  /** Русские исходники — ключи словаря: по ним видно, что схлопнул перевод. */
  titleKey: string;
  descriptionKey: string;
  bareTitle: (locale: Locale) => string;
  title: (locale: Locale) => string;
  description: (locale: Locale) => string;
};

/** Страницы, чьи тексты лежат в словаре и потому поддаются сверке. */
const staticPages: TextPage[] = publicPages.flatMap((page) => {
  const title = titleKey(page.source);
  const description = descriptionKey(page.source);
  if (!title || !description) return [];
  const suffix = brandSuffix(page.source);
  return [
    {
      file: page.file,
      route: page.route,
      titleKey: title,
      descriptionKey: description,
      bareTitle: (locale: Locale) => translate(locale, title),
      title: (locale: Locale) => translate(locale, title) + suffix,
      description: (locale: Locale) => translate(locale, description),
    },
  ];
});

// Раздел каталога — одна страница в файловой системе, но столько страниц в
// выдаче, сколько разделов. Сверяем каждый раздел отдельно: одинаковые заголовки
// «Десертов» и «Мяса» — такой же дубль, как у двух разных страниц. В сверку
// раздел попадает, только если страница правда читает category-texts.ts.
const categoryPage = publicPages.find((page) => page.route === CATEGORY_ROUTE);
const categoryPages: TextPage[] =
  categoryPage && readsCategoryTexts(categoryPage.source)
    ? categoryPageTexts().map((category) => ({
        ...category,
        file: `${categoryPage.file} (${category.slug})`,
        route: categoryPage.route,
      }))
    : [];

const textPages = [...staticPages, ...categoryPages];

test("публичные страницы со своим текстом найдены (разбор не разъехался с кодом)", () => {
  assertParsed(staticPages.length, 7, "страниц со статическими метаданными");
  assertParsed(categoryPages.length, 3, "разделов каталога с текстами из category-texts.ts");
});

test("из сверки выпали только страницы с текстом из базы", () => {
  // Если страница молча перестала разбираться, она тихо покинет проверку
  // уникальности. Список выпавших фиксируем поимённо: пополнился — разбираемся,
  // это новая страница на данных или сломанный разбор.
  const skipped = publicPages
    .filter((page) => !textPages.some((parsed) => parsed.route === page.route))
    .map((page) => page.route)
    .sort();

  assert.deepEqual(
    skipped,
    [...DATA_DRIVEN_TITLES].sort(),
    "из проверки уникальности выпала страница, которой нет в DATA_DRIVEN_TITLES: " +
      "либо это новая страница с текстом из базы (тогда впишите её в список с причиной), " +
      "либо разбор исходника перестал видеть title/description",
  );
});

/** Тексты, встретившиеся больше одного раза, с перечнем страниц-виновников. */
function duplicates(
  entries: { file: string; text: string; key: string }[],
): string[] {
  const byText = new Map<string, { file: string; key: string }[]>();
  for (const entry of entries) {
    const bucket = byText.get(entry.text) ?? [];
    bucket.push({ file: entry.file, key: entry.key });
    byText.set(entry.text, bucket);
  }

  return [...byText.entries()]
    .filter(([, pages]) => pages.length > 1)
    .map(([text, pages]) => {
      const where = pages.map((page) => page.file).join(", ");
      // Русские исходники различались, а перевод схлопнул их в один текст —
      // это чинится в словаре, а не на странице. Говорим об этом прямо.
      const sourceKeys = [...new Set(pages.map((page) => page.key))];
      const cause =
        sourceKeys.length > 1
          ? `\n    перевод схлопнул разные исходные строки: ${sourceKeys.map((k) => `«${k}»`).join(" и ")}`
          : "";
      return `«${text}»\n    на страницах: ${where}${cause}`;
    });
}

for (const locale of LOCALES as readonly Locale[]) {
  test(`заголовки публичных страниц уникальны [${locale}]`, () => {
    const found = duplicates(
      textPages.map((page) => ({
        file: page.file,
        key: page.titleKey,
        text: page.title(locale),
      })),
    );

    assert.deepEqual(
      found,
      [],
      `одинаковый <title> у нескольких страниц [${locale}] — поиск сочтёт их дублями ` +
        `и оставит в выдаче одну:\n  ${found.join("\n  ")}`,
    );
  });

  test(`описания публичных страниц уникальны [${locale}]`, () => {
    const found = duplicates(
      textPages.map((page) => ({
        file: page.file,
        key: page.descriptionKey,
        text: page.description(locale),
      })),
    );

    assert.deepEqual(
      found,
      [],
      `одинаковое <meta name="description"> у нескольких страниц [${locale}]:\n  ${found.join("\n  ")}`,
    );
  });
}

test("описание не повторяет заголовок той же страницы", () => {
  // Описание, дословно равное заголовку, поиск чаще всего выбрасывает и пишет
  // свой сниппет из текста страницы — то есть поле просто пропадает впустую.
  for (const page of textPages) {
    for (const locale of LOCALES as readonly Locale[]) {
      const title = page.bareTitle(locale);
      const description = page.description(locale);
      assert.notEqual(
        description,
        title,
        `${page.file} [${locale}]: описание дословно повторяет заголовок «${title}»`,
      );
    }
  }
});
