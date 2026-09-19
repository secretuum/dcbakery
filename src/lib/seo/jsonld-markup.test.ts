import { strict as assert } from "node:assert";
import { test } from "node:test";
import { buildProductJsonLd } from "@/src/components/seo/product-jsonld";
import { serializeJsonLd } from "@/src/components/seo/jsonld-serialize";
import { SITE_URL } from "@/src/lib/site-url";
import type { Product } from "@/src/types";
import { localizedPages } from "./page-sources";

// Разметка товара разобрана по полям в src/components/seo/product-jsonld.test.ts:
// там и состав Offer, и условия доставки и возврата по оферте, и запрет на пустые
// значения. Здесь НЕ дублируем это, а закрываем два других слоя:
//
//  1) разметка, КАК ОНА УХОДИТ В HTML. В страницу попадает не объект, а строка
//     из JSON.stringify внутри <script type="application/ld+json">. Проверка
//     объекта не поймает того, что строка не разбирается обратно;
//  2) «хлебные крошки». BreadcrumbList собирается прямо в двух page.tsx и не был
//     покрыт ничем: пропадут крошки — в выдаче у карточки товара исчезнет путь
//     Главная → Каталог → Раздел, а это видимая часть сниппета.

function product(patch: Partial<Product> = {}): Product {
  return {
    id: "p-1",
    name: "Пельмени с говядиной",
    slug: "pelmeni-s-govyadinoy",
    description: "Ручная лепка.",
    category_id: "cat-semi",
    price: 2500,
    unit: "шт",
    min_qty: 1,
    step_qty: 1,
    stock_qty: 40,
    images: ["/products/pelmeni-s-govyadinoy.webp"],
    is_active: true,
    sort_order: 1,
    ...patch,
  };
}

/**
 * Ровно то, что делает компонент JsonLd: объект -> строка в <script>.
 *
 * Зовём НАСТОЯЩУЮ сериализацию, а не свою копию JSON.stringify. Копия здесь
 * однажды уже разъехалась с компонентом: тот стал экранировать «меньше», а
 * тест продолжал проверять собственный JSON.stringify — зелёный сторож, не
 * стерегущий ничего. Меняется сериализация в компоненте — меняется и проверка.
 */
function asRendered(data: Record<string, unknown>): string {
  return serializeJsonLd(data);
}

function parsedMarkup(patch: Partial<Product> = {}): Record<string, unknown> {
  const data = buildProductJsonLd({
    product: product(patch),
    name: "Пельмени с говядиной",
    description: "Ручная лепка.",
    categoryName: "Полуфабрикаты",
    url: `${SITE_URL}/ru/product/pelmeni-s-govyadinoy`,
  });

  const rendered = asRendered(data);
  let back: unknown;
  try {
    back = JSON.parse(rendered);
  } catch (error) {
    assert.fail(
      `разметка товара не разбирается как JSON — поиск выбросит её целиком: ` +
        `${(error as Error).message}\n${rendered.slice(0, 200)}`,
    );
  }
  return back as Record<string, unknown>;
}

test("разметка товара уходит в страницу валидным JSON", () => {
  const data = parsedMarkup();

  assert.equal(data["@context"], "https://schema.org");
  assert.equal(data["@type"], "Product", "разметка перестала быть Product");
});

test("у товара есть предложение с ценой, валютой и наличием", () => {
  // Без любого из трёх полей Google не покажет карточку товара в расширенном
  // сниппете и напишет в Search Console «Отсутствует поле offers/price/...».
  const offers = parsedMarkup().offers as Record<string, unknown>;

  assert.ok(offers, "у товара пропал offers — расширенного сниппета не будет");
  assert.equal(offers["@type"], "Offer");
  assert.equal(typeof offers.price, "number", "price не число");
  assert.ok((offers.price as number) > 0, "price нулевой");
  assert.equal(offers.priceCurrency, "KZT");
  assert.match(
    String(offers.availability),
    /^https:\/\/schema\.org\/(InStock|OutOfStock)$/,
    "availability не из словаря schema.org",
  );
});

test("длинное тире и кавычки в названии не ломают разметку", () => {
  // Названия приходят из админки: «Торт "Медовик" — 1,5 кг» и подобное должно
  // пережить сериализацию, а не оборвать JSON на середине.
  const data = parsedMarkup({ name: 'Торт "Медовик" — 1,5 кг \\ порция' });
  assert.equal(data["@type"], "Product");
});

test("закрывающий тег скрипта в названии не закрывает тег разметки", () => {
  // Названия приезжают в том числе загрузкой прайса — из файла, который принёс
  // кто-то извне. JSON.stringify «</script>» не трогает, и тег закрылся бы
  // изнутри: разметка невалидна, а хвост строки уезжает в HTML как разметка.
  // Механика экранирования разобрана в src/components/seo/jsonld-serialize.test.ts,
  // здесь сторожим слой целиком — от сборки разметки товара до строки в странице.
  const hostile = 'Торт </script><img src=x> — 1,5 кг';
  const rendered = asRendered(
    buildProductJsonLd({
      product: product({ name: hostile }),
      name: hostile,
      description: "Ручная лепка.",
      categoryName: "Полуфабрикаты",
      url: `${SITE_URL}/ru/product/pelmeni-s-govyadinoy`,
    }),
  );

  assert.doesNotMatch(rendered, /<\/script/i, "тег скрипта закрывается изнутри разметки товара");
  // И данные при этом целы: экранирование меняет запись, а не текст названия.
  assert.equal((JSON.parse(rendered) as { name: string }).name, hostile);
});

// --- Хлебные крошки ----------------------------------------------------------

/** Страницы, у которых крошки обязаны быть: карточка товара и раздел каталога. */
const WITH_BREADCRUMBS = ["/product/[slug]", "/catalog/[category]"];

for (const route of WITH_BREADCRUMBS) {
  const page = localizedPages().find((candidate) => candidate.route === route);

  test(`${route}: страница на месте`, () => {
    assert.ok(page, `страницы ${route} больше нет — поправьте список WITH_BREADCRUMBS`);
  });

  test(`${route}: хлебные крошки собираются`, () => {
    const source = page!.source;

    assert.match(source, /"@type": "BreadcrumbList"/, "пропал BreadcrumbList");
    assert.match(source, /"@context": "https:\/\/schema\.org"/, "у разметки нет @context");
    assert.match(source, /itemListElement/, "в BreadcrumbList нет itemListElement");
  });

  test(`${route}: у каждой крошки есть позиция, имя и адрес`, () => {
    const source = page!.source;
    const start = source.indexOf("const breadcrumbJsonLd");
    assert.notEqual(start, -1, "блок breadcrumbJsonLd не найден — разбор разъехался с кодом");
    const block = source.slice(start, source.indexOf("\n  };", start));

    const items = [...block.matchAll(/"@type": "ListItem"/g)].length;
    const positions = [...block.matchAll(/position: (\d+)/g)].map((m) => Number(m[1]));
    const names = [...block.matchAll(/\bname:/g)].length;
    const links = [...block.matchAll(/\bitem: `/g)].length;

    assert.ok(items >= 3, `крошек всего ${items} — путь до страницы неполный`);
    assert.equal(positions.length, items, "у части крошек нет position — порядок не определён");
    assert.equal(names, items, "у части крошек нет name — в сниппете будет пусто");
    assert.equal(links, items, "у части крошек нет item — крошка никуда не ведёт");
    assert.equal(positions[0], 1, "нумерация крошек начинается не с 1");
    assert.ok(
      positions.every((position) => Number.isInteger(position) && position > 0),
      `позиции крошек не натуральные числа: ${positions.join(", ")}`,
    );
  });

  test(`${route}: собранные крошки действительно выводятся на страницу`, () => {
    // Собрать разметку и не отрисовать — ошибка, которую не видно ни в коде, ни
    // глазами на странице: переменная есть, тесты объекта зелёные, а в HTML пусто.
    assert.match(
      page!.source,
      /<JsonLd data=\{breadcrumbJsonLd\} \/>/,
      "breadcrumbJsonLd собран, но не выведен через <JsonLd> — в HTML крошек не будет",
    );
  });
}

test("карточка товара выводит и разметку товара", () => {
  const page = localizedPages().find((candidate) => candidate.route === "/product/[slug]");

  assert.match(
    page!.source,
    /<JsonLd data=\{productJsonLd\} \/>/,
    "productJsonLd собран, но не выведен через <JsonLd> — расширенного сниппета не будет",
  );
});
