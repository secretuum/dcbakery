import { test } from "node:test";
import assert from "node:assert/strict";
import { serializeJsonLd } from "@/src/components/seo/jsonld-serialize";

// Название товара, прилетевшее из админки или из загруженного прайса, может
// содержать что угодно, в том числе закрывающий тег скрипта. JSON.stringify его
// не трогает, и тег закрывался бы изнутри <script type="application/ld+json">.
const HOSTILE = 'Торт "Медовик" </script><img src=x onerror=alert(1)> — 1,5 кг';

test("закрывающий тег скрипта не доживает до разметки", () => {
  const rendered = serializeJsonLd({ name: HOSTILE });

  // Главное условие: последовательности, закрывающей тег, в строке нет вовсе.
  // Регистр не важен — браузер закрывает тег и на </ScRiPt.
  assert.doesNotMatch(rendered, /<\/script/i, "тег скрипта можно закрыть изнутри разметки");
  // «Меньше» не осталось ни одного: без него не открыть и комментарий <!--.
  assert.ok(!rendered.includes("<"), `в строке остался символ «меньше»: ${rendered}`);
});

test("результат по-прежнему разбирается как JSON", () => {
  const back = JSON.parse(serializeJsonLd({ name: HOSTILE })) as Record<string, unknown>;

  assert.equal(typeof back, "object");
  assert.ok(back);
});

test("экранирование не портит сами данные", () => {
  // Смысл правки — сделать невозможным закрытие тега, а НЕ поменять текст.
  // После разбора значение обязано совпасть с исходным посимвольно.
  const back = JSON.parse(serializeJsonLd({ name: HOSTILE })) as { name: string };

  assert.equal(back.name, HOSTILE);
  assert.ok(back.name.includes("</script>"), "угловые скобки пропали из значения");
});

test("экранируются вложенные поля и элементы массивов", () => {
  // Разметка товара — дерево: offers, хлебные крошки, списки. Дырка на любой
  // глубине рвёт тег так же, как на верхнем уровне.
  const data = {
    "@type": "Product",
    name: "Обычное название",
    offers: { "@type": "Offer", description: `Вложенное ${HOSTILE}` },
    itemListElement: [{ name: `В массиве ${HOSTILE}` }],
  };
  const rendered = serializeJsonLd(data);

  assert.doesNotMatch(rendered, /<\/script/i);
  assert.deepEqual(JSON.parse(rendered), data, "данные изменились при сериализации");
});

test("безобидная разметка не меняется", () => {
  // Регрессия на случай, если экранирование однажды начнут расширять: пока в
  // данных нет «меньше», результат обязан совпадать с обычным JSON.stringify.
  const data = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: "Пельмени с говядиной",
    offers: { "@type": "Offer", price: 2500, priceCurrency: "KZT" },
  };

  assert.equal(serializeJsonLd(data), JSON.stringify(data));
});

test("кириллица и кавычки переживают сериализацию", () => {
  // Кириллицу JSON.stringify оставляет как есть, и это нормально: страница в
  // UTF-8. Проверяем, что замена «меньше» ничего в ней не задела.
  const data = { name: 'Торт «Прага» — 1,5 кг \\ порция', description: 'Ручная лепка "как дома"' };

  assert.deepEqual(JSON.parse(serializeJsonLd(data)), data);
});
