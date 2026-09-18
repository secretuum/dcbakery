import { test } from "node:test";
import assert from "node:assert/strict";
import {
  productMetaDescription,
  PRODUCT_DESCRIPTION_FALLBACK,
} from "@/src/components/seo/product-description";
import { translateWith } from "@/src/i18n/translate-core";
import fs from "node:fs";
import path from "node:path";

/** Переводчик как на русской локали: словаря нет, подстановка переменных работает. */
const t = (text: string, vars?: Record<string, string | number>) => translateWith(null, text, vars);

test("своё описание отдаётся как есть", () => {
  assert.equal(
    productMetaDescription({ description: "Медовик на сметанном креме.", name: "Медовик", category: "Десерты", t }),
    "Медовик на сметанном креме.",
  );
});

test("пустое описание заменяется запасным текстом с названием и разделом", () => {
  for (const description of ["", "   ", null, undefined]) {
    const result = productMetaDescription({ description, name: "Пельмени с говядиной", category: "Полуфабрикаты", t });

    assert.ok(result.length > 0, "описание осталось пустым");
    assert.ok(result.includes("Пельмени с говядиной"), result);
    assert.ok(result.includes("Полуфабрикаты"), result);
    // Ни одна подстановка не осталась незакрытой.
    assert.ok(!result.includes("${"), result);
  }
});

test("запасной текст переводится словарём, а не остаётся русским", () => {
  const dict = { [PRODUCT_DESCRIPTION_FALLBACK]: "${name} — көтерме, «${category}» бөлімі." };
  const kk = (text: string, vars?: Record<string, string | number>) => translateWith(dict, text, vars);

  assert.equal(
    productMetaDescription({ description: "", name: "Медовик", category: "Десерттер", t: kk }),
    "Медовик — көтерме, «Десерттер» бөлімі.",
  );
});

// Запасной текст показывается вместо пустого описания, то есть у товаров без описания
// он и есть весь сниппет в выдаче. Пропавший ключ словаря откатит казахскую и
// английскую версии на русский молча — тест ловит это до выкладки.
test("запасной текст есть в казахском и английском словарях", () => {
  for (const name of ["kk", "en"]) {
    // Словарь читаем файлом, а не импортом: node:test требует import-атрибут
    // `with { type: "json" }`, которого в остальной кодовой базе нет.
    const dict = JSON.parse(
      fs.readFileSync(path.join(process.cwd(), "src/i18n", `${name}.json`), "utf8"),
    ) as Record<string, string>;
    const translated = dict[PRODUCT_DESCRIPTION_FALLBACK];

    assert.ok(translated, `в ${name}.json нет ключа запасного описания`);
    assert.notEqual(translated, PRODUCT_DESCRIPTION_FALLBACK, `${name}.json: перевод совпал с русским`);
    // Обе подстановки обязаны уцелеть при переводе, иначе в сниппет уйдёт текст без
    // названия товара или без раздела.
    for (const slot of ["${name}", "${category}"]) {
      assert.ok(translated.includes(slot), `${name}.json: потеряна подстановка ${slot}`);
    }
  }
});
