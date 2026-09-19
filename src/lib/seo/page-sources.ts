// Разбор исходников app/**/page.tsx для тестов-сторожей SEO. Кода сайта здесь нет:
// модуль никем из app/ не импортируется и в сборку не попадает.
//
// Почему разбор ТЕКСТА, а не импорт страницы: generateMetadata в этих файлах
// асинхронная и тянет getLocale()/getT() (next/headers) и fetchProductBySlug
// (supabase -> next/cache) — в тест-раннере это не поднимается. Тот же приём уже
// применён в sitemap-lastmod.test.ts и metadata-length.test.ts по той же причине.
//
// Разбор текста хрупок ровно в одном месте: стоит формату вызова в app/ разъехаться
// с регулярками ниже — и страница просто перестанет находиться, а тесты останутся
// зелёными. Поэтому КАЖДЫЙ тест, который пользуется этим модулем, обязан сначала
// проверить, что список страниц не опустел (assertParsed ниже), а не молча
// прогнать проверки по нулю страниц.

import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { strict as assert } from "node:assert";
import { LOCALES, type Locale } from "@/src/i18n/config";

const ROOT = process.cwd();

/** Локализованные страницы живут только здесь: app/(unlocalized)/** — админка, оплата, документы. */
const LOCALIZED_APP_DIR = path.join(ROOT, "app", "[locale]");

export type PageSource = {
  /** Путь от корня репозитория — его и показываем в сообщении об ошибке. */
  file: string;
  /** Маршрут БЕЗ языкового префикса: "/", "/catalog", "/catalog/[category]". */
  route: string;
  source: string;
};

function pageFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return pageFiles(full);
    return entry.name === "page.tsx" ? [full] : [];
  });
}

/**
 * Маршрут страницы по её пути в файловой системе. Группы маршрутов — (main), (shop) —
 * на адрес не влияют и выбрасываются; динамические сегменты остаются как [category].
 */
function routeOf(file: string): string {
  const segments = path
    .relative(LOCALIZED_APP_DIR, file)
    .split(path.sep)
    .slice(0, -1) // page.tsx
    .filter((segment) => !segment.startsWith("("));

  return segments.length ? `/${segments.join("/")}` : "/";
}

/** Все локализованные страницы сайта, отсортированные по маршруту. */
export function localizedPages(): PageSource[] {
  return pageFiles(LOCALIZED_APP_DIR)
    .map((file) => ({
      file: path.relative(ROOT, file),
      route: routeOf(file),
      source: readFileSync(file, "utf8"),
    }))
    .sort((a, b) => a.route.localeCompare(b.route));
}

/**
 * Сторож самого разбора: если регулярки разъедутся с кодом, тесты должны падать
 * здесь и с понятной причиной, а не зеленеть на пустом списке.
 */
export function assertParsed(count: number, expected: number, what: string): void {
  assert.ok(
    count >= expected,
    `${what}: найдено ${count} при ожидаемых ${expected}+. Разбор исходников разъехался ` +
      `с кодом — проверьте регулярки в src/lib/seo/page-sources.ts, а не ослабляйте порог.`,
  );
}

// --- Разбор метаданных страницы ---------------------------------------------

/** `path:` в вызове buildPageMetadata — строка "/catalog" или шаблон `/catalog/${category}`. */
const METADATA_PATH = /buildPageMetadata\(\{\s*path:\s*(`[^`]*`|"[^"]*")/;

/** `const title = t("…")` — ключ словаря — сам русский текст. */
const TITLE_KEY = /const title = t\(\s*"((?:[^"\\]|\\.)*)"/;
const DESCRIPTION_KEY = /const description = t\(\s*"((?:[^"\\]|\\.)*)"/;

/** Бренд дописывается в коде, а не в словаре: `${title} | DC Bakery`. */
const BRAND_SUFFIX_MARK = "title: `${title} | DC Bakery`";
export const BRAND_SUFFIX = " | DC Bakery";

/** Путь, переданный сборщику метаданных, приведённый к виду маршрута: `${x}` -> [*]. */
export function metadataRoute(source: string): string | undefined {
  const raw = METADATA_PATH.exec(source)?.[1];
  if (!raw) return undefined;
  return raw.slice(1, -1).replace(/\$\{[^}]*\}/g, "[*]");
}

/** Маршрут из файловой системы в том же виде: [category] -> [*]. */
export function routePattern(route: string): string {
  return route.replace(/\[[^\]]+\]/g, "[*]");
}

export function hasGenerateMetadata(source: string): boolean {
  return /export (?:async )?function generateMetadata/.test(source);
}

/** Страница объявляет себя неиндексируемой прямо в метаданных. */
export function hasNoIndex(source: string): boolean {
  return /robots:\s*\{[^}]*index:\s*false/.test(source);
}

export function titleKey(source: string): string | undefined {
  return TITLE_KEY.exec(source)?.[1];
}

export function descriptionKey(source: string): string | undefined {
  return DESCRIPTION_KEY.exec(source)?.[1];
}

export function brandSuffix(source: string): string {
  return source.includes(BRAND_SUFFIX_MARK) ? BRAND_SUFFIX : "";
}

// --- Словари ----------------------------------------------------------------

const dictionaries: Record<string, Record<string, string>> = {
  kk: JSON.parse(readFileSync(path.join(ROOT, "src/i18n/kk.json"), "utf8")),
  en: JSON.parse(readFileSync(path.join(ROOT, "src/i18n/en.json"), "utf8")),
};

/** Как t() на сервере: русский — исходник, остальное из словаря с откатом на русский. */
export function translate(locale: Locale, ru: string): string {
  return locale === "ru" ? ru : (dictionaries[locale][ru] ?? ru);
}

export { LOCALES };
export type { Locale };

// --- Страницы, намеренно живущие без метаданных для поиска -------------------
//
// Молчаливое «кроме тех, где нет» через полгода никто не расшифрует, поэтому
// список явный и с причиной на каждую строку. Тест metadata-required.test.ts
// требует, чтобы каждая страница отсюда была РЕАЛЬНО закрыта от индексации —
// в app/robots.ts или через robots:{index:false} в своих метаданных. Просто
// «забыли метаданные» в этот список не проходит.
export const WITHOUT_PUBLIC_METADATA: Record<string, string> = {
  "/cart": "Корзина: содержимое у каждого своё, индексировать нечего. Закрыта в robots.",
  "/checkout": "Форма оформления заявки, не контент. Закрыта в robots.",
  "/order-success": "В адресе номер заказа — в выдаче ему не место. Закрыта в robots.",
  "/profile": "Личный кабинет, вход по паролю. Закрыт в robots.",
  "/profile/reset": "Сброс пароля по одноразовой ссылке. Закрыт в robots вместе с /profile.",
  "/register": "Форма регистрации B2B-клиента: собственный robots:{index:false}.",
};

// --- Публичные страницы, у которых заголовок берётся из данных ---------------
//
// Заголовок и описание карточки товара и раздела каталога приходят из базы
// (название товара, название и описание категории), а не из словаря. Проверить
// их уникальность разбором исходника нельзя — там шаблон, а не текст. Сторожа
// на уникальность к ним не применяем и говорим об этом вслух, чтобы «страница
// молча выпала из проверки» не выглядело как «страниц всего семь».
export const DATA_DRIVEN_TITLES = ["/catalog/[category]", "/product/[slug]"];

// --- Служебные страницы без языкового префикса -------------------------------

/** app/(unlocalized)/** — админка, страницы оплаты, печатные документы. */
const UNLOCALIZED_APP_DIR = path.join(ROOT, "app", "(unlocalized)");

/**
 * Маршруты служебных страниц: /admin, /admin/orders/[id], /pay/[orderId]/card и т.д.
 * Каждый из них обязан быть закрыт в robots.txt — на это ругается robots.test.ts,
 * и новая страница админки попадает под проверку сама, без правки списков.
 */
export function unlocalizedRoutes(): { file: string; route: string }[] {
  return pageFiles(UNLOCALIZED_APP_DIR)
    .map((file) => {
      const segments = path
        .relative(UNLOCALIZED_APP_DIR, file)
        .split(path.sep)
        .slice(0, -1)
        .filter((segment) => !segment.startsWith("("));
      return { file: path.relative(ROOT, file), route: `/${segments.join("/")}` };
    })
    .sort((a, b) => a.route.localeCompare(b.route));
}

/** Динамический сегмент -> образец: адрес нужен настоящий, а не шаблон. */
export function sampleRoute(route: string): string {
  return route.replace(/\[[^\]]+\]/g, "obrazets");
}
