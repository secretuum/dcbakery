import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ProductCard } from "@/src/components/catalog/ProductCard";
import {
  fetchCategories,
  fetchCategoryBySlug,
  fetchCategorySlugs,
  fetchProductsByCategory,
} from "@/src/lib/catalog";
import { getLocale, getT } from "@/src/i18n/server";
import { localizeProduct } from "@/src/i18n/product";
import { withLocale } from "@/src/i18n/routing";
import { JsonLd } from "@/src/components/seo/JsonLd";
import { buildItemListJsonLd } from "@/src/components/seo/item-list";
import { buildPageMetadata, pageUrl } from "@/src/components/seo/page-metadata";
import { SITE_URL } from "@/src/lib/site-url";
import { categoryMetaTitle, categoryTexts } from "@/src/lib/seo/category-texts";

type CategoryPageProps = {
  params: Promise<{
    category: string;
  }>;
};

export async function generateStaticParams() {
  return fetchCategorySlugs();
}

export async function generateMetadata({ params }: CategoryPageProps): Promise<Metadata> {
  const { category } = await params;
  const currentCategory = await fetchCategoryBySlug(category);
  const t = await getT();

  if (!currentCategory) {
    return {
      // Разделитель «| DC Bakery» держим в коде, а не в ключе словаря
      title: `${t("Категория не найдена")} | DC Bakery`,
    };
  }

  const locale = await getLocale();
  const categoryName = t(currentCategory.name);
  // Тексты для поиска — из модуля по слагу, там их видят сторожа SEO. Шаблон ниже
  // остаётся только для разделов, скрытых флагом до запуска (см. category-texts.test.ts).
  const texts = categoryTexts(category);
  const title = texts
    ? categoryMetaTitle(texts, (ru) => t(ru))
    : `${categoryName} | ${t("Каталог DC Bakery")}`;
  const description = texts
    ? t(texts.description)
    : currentCategory.description
      ? t(currentCategory.description)
      : t("B2B-каталог DC Bakery: раздел ${category}.", {
          category: categoryName.toLowerCase(),
        });
  // Превью ссылки на раздел: фото первого товара раздела. Своей картинки у
  // категории нет (в каталоге там заглушка), а брендовая обложка одинакова у всех
  // разделов — по ней в мессенджере не отличить «Десерты» от «Мяса».
  const products = await fetchProductsByCategory(category);
  const image = products.find((product) => product.images?.[0])?.images?.[0];

  return {
    title,
    description,
    ...buildPageMetadata({
      path: `/catalog/${category}`,
      locale,
      title: texts ? t(texts.title) : categoryName,
      description,
      image,
    }),
  };
}

export default async function CategoryPage({ params }: CategoryPageProps) {
  const { category } = await params;
  const currentCategory = await fetchCategoryBySlug(category);

  if (!currentCategory) {
    notFound();
  }

  const [categories, products, t, locale] = await Promise.all([
    fetchCategories(),
    fetchProductsByCategory(category),
    getT(),
    getLocale(),
  ]);
  const facts = categoryTexts(category)?.facts ?? [];

  // «Хлебные крошки» для поиска: Главная → Каталог → Категория.
  const breadcrumbJsonLd: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: t("Главная"), item: `${SITE_URL}/${locale}/` },
      { "@type": "ListItem", position: 2, name: t("Каталог"), item: `${SITE_URL}/${locale}/catalog` },
      {
        "@type": "ListItem",
        position: 3,
        // Имя в крошках должно совпадать с видимым H1 — переводим так же
        name: t(currentCategory.name),
        item: `${SITE_URL}/${locale}/catalog/${currentCategory.slug}`,
      },
    ],
  };

  // Перечень позиций раздела: для поиска и ИИ-ассистентов страница раздела —
  // это список товаров со ссылками, а не просто заголовок с картинками.
  const itemListJsonLd = buildItemListJsonLd({
    name: t(currentCategory.name),
    url: pageUrl(`/catalog/${currentCategory.slug}`, locale),
    items: products.map((product) => ({
      name: localizeProduct(product, locale).name,
      url: `${SITE_URL}/${locale}/product/${product.slug}`,
    })),
  });

  return (
    <main className="min-h-screen bg-cream text-dark">
      <JsonLd data={breadcrumbJsonLd} />
      <JsonLd data={itemListJsonLd} />
      <section className="mx-auto max-w-7xl px-5 py-10 lg:px-8 lg:py-14">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-sm font-bold uppercase text-raspberry">{t("Каталог")}</p>
            <h1 className="mt-3 text-3xl font-bold leading-tight tracking-tight sm:text-4xl lg:text-5xl">
              {t(currentCategory.name)}
            </h1>
            {currentCategory.intro ?? currentCategory.description ? (
              <p className="mt-4 max-w-2xl text-base font-semibold leading-7 text-muted">
                {t((currentCategory.intro ?? currentCategory.description) as string)}
              </p>
            ) : null}
            {facts.length > 0 ? (
              <dl
                className="mt-5 flex max-w-2xl flex-wrap gap-2"
                aria-label={t("Коротко о разделе")}
              >
                {facts.map((fact) => (
                  <div
                    key={fact.label}
                    className="rounded-btn bg-white px-3 py-2 text-sm font-semibold shadow-sm"
                  >
                    <dt className="inline text-muted">{t(fact.label)}: </dt>
                    <dd className="inline text-dark">{t(fact.value)}</dd>
                  </div>
                ))}
              </dl>
            ) : null}
          </div>

          <div className="rounded-card bg-white px-5 py-4 text-sm font-bold text-muted shadow-sm">
            <span className="text-xl font-bold text-dark">{products.length}</span> {t("позиций")}
          </div>
        </div>

        <nav className="mt-8 flex gap-2 overflow-x-auto pb-2" aria-label={t("Категории каталога")}>
          <Link
            href={withLocale("/catalog", locale)}
            className="shrink-0 rounded-btn bg-white px-4 py-2 text-sm font-bold text-muted shadow-sm transition hover:bg-coral-light hover:text-dark"
          >
            {t("Все разделы")}
          </Link>
          {categories.map((item) => {
            const isActive = item.slug === currentCategory.slug;

            return (
              <Link
                key={item.id}
                href={withLocale(`/catalog/${item.slug}`, locale)}
                className={`shrink-0 rounded-btn px-4 py-2 text-sm font-bold shadow-sm transition ${
                  isActive
                    ? "bg-dark text-white"
                    : "bg-white text-muted hover:bg-coral-light hover:text-dark"
                }`}
              >
                {t(item.name)}
              </Link>
            );
          })}
        </nav>

        {products.length > 0 ? (
          <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {products.map((product, i) => (
              <ProductCard key={product.id} product={product} priority={i < 6} />
            ))}
          </div>
        ) : (
          <div className="mt-8 rounded-card bg-white p-8 text-center shadow-[0_18px_60px_rgba(120,51,38,0.10)]">
            <h2 className="text-3xl font-bold">{t("Позиции скоро появятся")}</h2>
            <p className="mx-auto mt-3 max-w-xl text-sm font-semibold leading-6 text-muted">
              {t("Раздел уже подготовлен, но товары пока не добавлены в локальный mock-каталог.")}
            </p>
          </div>
        )}
      </section>
    </main>
  );
}
