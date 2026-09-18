import { test } from "node:test";
import assert from "node:assert/strict";
import { toAbsoluteUrl } from "@/src/components/seo/absolute-url";
import { SITE_URL } from "@/src/lib/site-url";

// Регрессия на сломанные превью ссылок: фото из админки — абсолютный URL Supabase
// Storage, и склейка с SITE_URL давала "https://dc-bakery.kzhttps://...".
test("абсолютный URL не удваивается префиксом сайта", () => {
  const supabase =
    "https://vdydhptmfhnrjrtqxktw.supabase.co/storage/v1/object/public/product-images/products/pelmeni.webp";

  assert.equal(toAbsoluteUrl(supabase), supabase);
  assert.equal(toAbsoluteUrl("http://example.com/a.png"), "http://example.com/a.png");
  // Регистр схемы значения не имеет.
  assert.equal(toAbsoluteUrl("HTTPS://example.com/a.png"), "HTTPS://example.com/a.png");
});

test("относительный путь получает префикс сайта", () => {
  assert.equal(toAbsoluteUrl("/products/tort-medovik.webp"), `${SITE_URL}/products/tort-medovik.webp`);
  // Без ведущего слэша тоже собирается в валидный адрес, без склейки "kzproducts".
  assert.equal(toAbsoluteUrl("products/tort-medovik.webp"), `${SITE_URL}/products/tort-medovik.webp`);
});

test("протокол-относительный адрес получает схему", () => {
  assert.equal(toAbsoluteUrl("//cdn.example.com/a.png"), "https://cdn.example.com/a.png");
});

test("пустое значение → undefined (поле опускаем, а не отдаём мусор)", () => {
  assert.equal(toAbsoluteUrl(""), undefined);
  assert.equal(toAbsoluteUrl("   "), undefined);
  assert.equal(toAbsoluteUrl(null), undefined);
  assert.equal(toAbsoluteUrl(undefined), undefined);
});

test("результат всегда разбирается как URL с нашим хостом или хостом хранилища", () => {
  const cases = ["/a.png", "a.png", "https://x.supabase.co/a.png", "//cdn.example.com/a.png"];
  for (const value of cases) {
    const result = toAbsoluteUrl(value);
    assert.ok(result, `не собрался URL для ${value}`);
    const parsed = new URL(result);
    assert.ok(/^https?:$/.test(parsed.protocol));
    // Ровно та поломка, что была на проде: host "dc-bakery.kzhttps".
    assert.ok(!parsed.host.includes("https"), `битый host: ${parsed.host}`);
  }
});
