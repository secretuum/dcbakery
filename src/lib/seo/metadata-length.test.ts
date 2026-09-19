import { strict as assert } from "node:assert";
import { test } from "node:test";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";

// Длина метаданных — не вкусовщина, а порог обрезки в выдаче: описание длиннее
// ~160 символов Google режет многоточием, и хвост ключевых слов пропадает. Один
// и тот же русский текст даёт РАЗНУЮ длину на kk и en (казахский обычно на 10-20%
// длиннее), поэтому меряем все три локали, а не только исходник.
//
// Тест разбирает generateMetadata регулярками по исходнику страницы: гонять
// настоящий Next-рендер ради длины строки дороже и хрупче, а формат вызова
// t("…") в этих файлах единообразный.

const ROOT = process.cwd();
const MAX_DESCRIPTION = 160;
const MAX_TITLE = 60;

const dictionaries: Record<string, Record<string, string>> = {
  kk: JSON.parse(readFileSync(path.join(ROOT, "src/i18n/kk.json"), "utf8")),
  en: JSON.parse(readFileSync(path.join(ROOT, "src/i18n/en.json"), "utf8")),
};

function translate(locale: string, ru: string): string {
  return locale === "ru" ? ru : dictionaries[locale][ru] ?? ru;
}

function pageFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return pageFiles(full);
    return entry.name === "page.tsx" ? [full] : [];
  });
}

const DESCRIPTION = /const description = t\(\s*"((?:[^"\\]|\\.)*)"/;
const TITLE = /const title = t\(\s*"((?:[^"\\]|\\.)*)"/;
const BRAND_SUFFIX = "title: `${title} | DC Bakery`";

const pages = pageFiles(path.join(ROOT, "app"))
  .map((file) => {
    const source = readFileSync(file, "utf8");
    const description = DESCRIPTION.exec(source)?.[1];
    if (!description) return null;
    return {
      name: path.relative(ROOT, file),
      description,
      title: TITLE.exec(source)?.[1],
      suffix: source.includes(BRAND_SUFFIX) ? " | DC Bakery" : "",
    };
  })
  .filter((page) => page !== null);

test("страницы с метаданными найдены (регулярка не разъехалась с кодом)", () => {
  assert.ok(pages.length >= 7, `найдено страниц: ${pages.length}`);
});

for (const page of pages) {
  for (const locale of ["ru", "kk", "en"]) {
    test(`${page.name} [${locale}]: описание не режется в выдаче`, () => {
      const text = translate(locale, page.description);
      assert.ok(
        text.length <= MAX_DESCRIPTION,
        `${text.length} символов при пороге ${MAX_DESCRIPTION}: ${text}`,
      );
    });

    if (page.title) {
      test(`${page.name} [${locale}]: заголовок не режется в выдаче`, () => {
        const text = translate(locale, page.title!) + page.suffix;
        assert.ok(
          text.length <= MAX_TITLE,
          `${text.length} символов при пороге ${MAX_TITLE}: ${text}`,
        );
      });
    }

    if (locale === "ru") continue;

    test(`${page.name} [${locale}]: метаданные переведены`, () => {
      // Ключ словаря — сам русский текст. Стоит поправить русскую строку и забыть
      // словарь, как t() молча отдаст русский на казахской/английской странице.
      assert.ok(
        dictionaries[locale][page.description],
        `нет перевода описания: ${page.description}`,
      );
      if (page.title) {
        assert.ok(
          dictionaries[locale][page.title],
          `нет перевода заголовка: ${page.title}`,
        );
      }
    });
  }
}
