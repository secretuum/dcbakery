import { test } from "node:test";
import assert from "node:assert/strict";
import { buildPageMetadata, pageUrl, BRAND_OG_IMAGE } from "@/src/components/seo/page-metadata";
import { SITE_URL } from "@/src/lib/site-url";

function og(meta: ReturnType<typeof buildPageMetadata>) {
  const value = meta.openGraph;
  assert.ok(value, "openGraph не собран");
  return value as Record<string, unknown>;
}

function firstImage(meta: ReturnType<typeof buildPageMetadata>) {
  const images = og(meta).images as { url: string }[];
  return images[0];
}

test("og:url ведёт на саму страницу, а не на корень локали", () => {
  assert.equal(og(buildPageMetadata(base("/catalog", "ru"))).url, `${SITE_URL}/ru/catalog`);
  assert.equal(
    og(buildPageMetadata(base("/catalog/deserty", "kk"))).url,
    `${SITE_URL}/kk/catalog/deserty`,
  );
  assert.equal(og(buildPageMetadata(base("/optom", "en"))).url, `${SITE_URL}/en/optom`);
});

test("корень локали не получает хвостового слэша", () => {
  assert.equal(og(buildPageMetadata(base("/", "kk"))).url, `${SITE_URL}/kk`);
  assert.equal(pageUrl("/", "ru"), `${SITE_URL}/ru`);
});

test("canonical совпадает с og:url, hreflang перечисляет три локали и x-default", () => {
  const meta = buildPageMetadata(base("/contacts", "ru"));
  const alternates = meta.alternates as { canonical: string; languages: Record<string, string> };

  assert.equal(alternates.canonical, og(meta).url);
  assert.deepEqual(Object.keys(alternates.languages).sort(), ["en", "kk-KZ", "ru-KZ", "x-default"]);
  assert.equal(alternates.languages["x-default"], `${SITE_URL}/kk/contacts`);
});

test("alternateLocale перечисляет ДРУГИЕ локали, а og:locale — текущую", () => {
  const meta = buildPageMetadata(base("/optom", "ru"));

  assert.equal(og(meta).locale, "ru_RU");
  assert.deepEqual(og(meta).alternateLocale, ["kk_KZ", "en_US"]);
});

test("без своей картинки — брендовая обложка с известными размерами", () => {
  const image = firstImage(buildPageMetadata(base("/catalog", "ru")));

  assert.deepEqual(image, {
    url: `${SITE_URL}${BRAND_OG_IMAGE}`,
    width: 1200,
    height: 630,
    alt: "DC Bakery",
  });
});

test("фото товара из админки уходит в og:image как есть, без склейки с доменом", () => {
  const photo = "https://vdydhptmfhnrjrtqxktw.supabase.co/storage/v1/object/public/a.webp";
  const meta = buildPageMetadata({ ...base("/product/pelmeni", "ru"), image: photo });

  assert.equal(firstImage(meta).url, photo);
  assert.equal(new URL(firstImage(meta).url).host, "vdydhptmfhnrjrtqxktw.supabase.co");
});

test("фото из репозитория получает домен сайта", () => {
  const meta = buildPageMetadata({ ...base("/product/medovik", "ru"), image: "/products/m.webp" });

  assert.equal(firstImage(meta).url, `${SITE_URL}/products/m.webp`);
});

test("twitter-картинка совпадает с og-картинкой", () => {
  const photo = "https://x.supabase.co/a.webp";
  const withPhoto = buildPageMetadata({ ...base("/product/p", "ru"), image: photo });
  const withoutPhoto = buildPageMetadata(base("/privacy", "ru"));

  assert.deepEqual((withPhoto.twitter as { images: string[] }).images, [photo]);
  assert.deepEqual((withoutPhoto.twitter as { images: string[] }).images, [
    `${SITE_URL}${BRAND_OG_IMAGE}`,
  ]);
});

test("заголовок и описание страницы уходят и в og, и в twitter", () => {
  const meta = buildPageMetadata({
    path: "/oferta",
    locale: "ru",
    title: "Публичная оферта",
    description: "Договор поставки.",
  });

  assert.equal(og(meta).title, "Публичная оферта");
  assert.equal(og(meta).description, "Договор поставки.");
  assert.equal((meta.twitter as { title: string }).title, "Публичная оферта");
  assert.equal((meta.twitter as { description: string }).description, "Договор поставки.");
});

function base(path: string, locale: "ru" | "kk" | "en") {
  return { path, locale, title: "Заголовок", description: "Описание" } as const;
}
