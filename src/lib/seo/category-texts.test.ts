import { strict as assert } from "node:assert";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import path from "node:path";
import { products } from "@/src/data/products";
import { CATEGORY_TEXTS } from "./category-texts";
import {
  CATEGORY_ROUTE,
  LOCALES,
  categoryPageTexts,
  localizedPages,
  readsCategoryTexts,
  type Locale,
} from "./page-sources";

// Сторож страниц разделов каталога. Раньше /catalog/[category] выпадал из всех
// проверок метаданных: заголовок собирался шаблоном `${categoryName} | …`, а
// описание бралось из данных раздела — разбору исходника там нечего мерить. Так
// в выдаче и жили описания на 69–79 символов и заголовки без «оптом» и «Алматы».
//
// Нижний порог длины описания здесь — ТОЛЬКО для разделов каталога. Общий сторож
// (metadata-length.test.ts) меряет лишь потолок: глобальный минимум покрасил бы
// служебные страницы (контакты, приватность), которым длинное описание не нужно.
// Разделы — коммерческие страницы под запросы «… оптом Алматы», им короткий
// сниппет стоит кликов.

const ROOT = process.cwd();
const MIN_DESCRIPTION = 150;
const MAX_DESCRIPTION = 160;
const MAX_TITLE = 60;

/** Слова, без которых раздел не находится по коммерческому запросу. */
const TITLE_KEYWORDS: Record<Locale, RegExp[]> = {
  ru: [/оптом/i, /Алматы/],
  kk: [/көтерме/i, /Алматы/],
  en: [/wholesale/i, /Almaty/],
};

/**
 * Разделы из src/lib/catalog.ts, которым тексты пока не нужны, — с причиной.
 * Страница для них откатывается на шаблон, поэтому в список проходит только
 * раздел, скрытый с витрины (is_active не литерал true).
 */
const WITHOUT_TEXTS: Record<string, string> = {
  "gotovye-obedy": "Готовые обеды скрыты флагом READY_MEALS_ENABLED до запуска.",
  "banketnye-deserty": "Банкетные десерты скрыты флагом BANQUET_DESSERTS_ENABLED до запуска.",
};

const dictionaries: Record<string, Record<string, string>> = {
  kk: JSON.parse(readFileSync(path.join(ROOT, "src/i18n/kk.json"), "utf8")),
  en: JSON.parse(readFileSync(path.join(ROOT, "src/i18n/en.json"), "utf8")),
};

/**
 * Разделы из categoryDetails в src/lib/catalog.ts: слаг и признак «виден на витрине».
 * Разбор текста, а не импорт: catalog.ts тянет supabase и next/cache.
 */
function catalogCategories(): { slug: string; active: boolean }[] {
  const source = readFileSync(path.join(ROOT, "src/lib/catalog.ts"), "utf8");
  const block = /const categoryDetails[\s\S]*?\n\};/.exec(source)?.[0] ?? "";
  return [...block.matchAll(/slug:\s*"([^"]+)"[\s\S]*?is_active:\s*([^,\n]+)/g)].map((match) => ({
    slug: match[1],
    active: match[2].trim() === "true",
  }));
}

const categories = categoryPageTexts();

test("страница раздела берёт заголовок и описание из category-texts.ts", () => {
  const page = localizedPages().find((candidate) => candidate.route === CATEGORY_ROUTE);
  assert.ok(page, `не найдена страница ${CATEGORY_ROUTE}`);
  assert.ok(
    readsCategoryTexts(page.source),
    `${page.file}: метаданные раздела собираются в обход category-texts.ts — ` +
      "сторожа ниже проверяют модуль, который страница не показывает",
  );
});

test("у каждого раздела на витрине есть тексты", () => {
  const inCatalog = catalogCategories();
  assert.ok(inCatalog.length >= 5, `разбор catalog.ts нашёл разделов: ${inCatalog.length}`);

  for (const { slug, active } of inCatalog) {
    if (slug in CATEGORY_TEXTS) continue;
    assert.ok(
      slug in WITHOUT_TEXTS,
      `раздел ${slug} есть в каталоге, но без текстов в category-texts.ts — ` +
        "страница покажет шаблонный заголовок и короткое описание",
    );
    assert.ok(
      !active,
      `раздел ${slug} открыт на витрине (is_active: true), а числится в WITHOUT_TEXTS — ` +
        "напишите ему тексты",
    );
  }

  for (const slug of Object.keys(CATEGORY_TEXTS)) {
    assert.ok(
      inCatalog.some((category) => category.slug === slug),
      `в category-texts.ts есть ${slug}, а в каталоге такого раздела нет — опечатка в слаге?`,
    );
  }
});

for (const category of categories) {
  for (const locale of LOCALES as readonly Locale[]) {
    test(`раздел ${category.slug} [${locale}]: описание ${MIN_DESCRIPTION}–${MAX_DESCRIPTION} символов`, () => {
      const text = category.description(locale);
      assert.ok(
        text.length >= MIN_DESCRIPTION && text.length <= MAX_DESCRIPTION,
        `${text.length} символов при норме ${MIN_DESCRIPTION}–${MAX_DESCRIPTION}: ${text}`,
      );
    });

    test(`раздел ${category.slug} [${locale}]: заголовок не режется и называет опт и город`, () => {
      const text = category.title(locale);
      assert.ok(text.length <= MAX_TITLE, `${text.length} символов при пороге ${MAX_TITLE}: ${text}`);
      for (const keyword of TITLE_KEYWORDS[locale]) {
        assert.match(text, keyword, `в заголовке нет ${keyword}: ${text}`);
      }
    });

    if (locale === "ru") continue;

    test(`раздел ${category.slug} [${locale}]: тексты переведены`, () => {
      // Ключ словаря — сам русский текст: поправили русскую строку и забыли
      // словарь — t() молча отдаст русский на казахской/английской странице.
      const facts = CATEGORY_TEXTS[category.slug].facts.flatMap((fact) => [fact.label, fact.value]);
      for (const key of [category.titleKey, category.descriptionKey, ...facts]) {
        assert.ok(dictionaries[locale][key], `нет перевода: ${key}`);
      }
    });
  }
}

// --- Факты раздела против данных товаров --------------------------------------
//
// Блок фактов написан руками по src/data/products.ts. Чтобы он не врал после смены
// ассортимента, фиксируем, на чём он основан: какие значения хранения, срока и
// упаковки встречаются у товаров раздела. Поменялись данные — тест краснеет и
// просит перечитать facts в category-texts.ts, а не молча оставляет «−18 °C».

const FACTS_BASIS: Record<
  string,
  { category: string; storage: string[]; shelfLife: string[]; packageType: string[] }
> = {
  deserty: {
    category: "Десерты",
    storage: ["Хранить при +2…+4°C", "Хранить при +2…+8°C"],
    // «Уточнить» у части позиций — поэтому в фактах вилка с оговоркой.
    shelfLife: ["10 суток", "3 суток", "5 суток", "72 часа", "Уточнить"],
    packageType: ["банка", "коробка"],
  },
  polufabrikaty: {
    category: "Полуфабрикаты",
    storage: ["Хранить при -18°C"],
    shelfLife: ["6 мес."],
    packageType: ["вакуум"],
  },
  myaso: {
    category: "Мясо",
    storage: ["Хранить при -18°C"],
    shelfLife: ["12 мес.", "6 мес."],
    packageType: ["вакуум"],
  },
};

const distinct = (values: string[]) => [...new Set(values)].sort();

for (const slug of Object.keys(CATEGORY_TEXTS)) {
  test(`раздел ${slug}: факты сходятся с данными товаров`, () => {
    const basis = FACTS_BASIS[slug];
    assert.ok(basis, `для ${slug} не записано, по каким данным составлены факты`);

    const items = products.filter((product) => product.category === basis.category);
    assert.ok(items.length > 0, `в src/data/products.ts нет товаров раздела «${basis.category}»`);

    const hint = `— данные раздела ${slug} изменились, перечитайте facts в category-texts.ts`;
    assert.deepEqual(distinct(items.map((p) => p.storage)), distinct(basis.storage), `хранение ${hint}`);
    assert.deepEqual(distinct(items.map((p) => p.shelfLife)), distinct(basis.shelfLife), `срок ${hint}`);
    assert.deepEqual(distinct(items.map((p) => p.packageType)), distinct(basis.packageType), `упаковка ${hint}`);

    const claimsHalal = CATEGORY_TEXTS[slug].facts.some((fact) => fact.label === "Халал");
    if (claimsHalal) {
      const notHalal = items.filter((product) => !product.isHalal).map((product) => product.slug);
      assert.deepEqual(notHalal, [], `в фактах «халал у всех позиций», а у этих товаров нет: ${notHalal}`);
    }
  });
}
