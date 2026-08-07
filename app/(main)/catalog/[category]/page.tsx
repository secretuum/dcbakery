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
import { withLocale, buildAlternates } from "@/src/i18n/routing";
import { JsonLd } from "@/src/components/seo/JsonLd";
import { SITE_URL } from "@/src/lib/site-url";

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

  return {
    title: `${categoryName} | ${t("Каталог DC Bakery")}`,
    description: currentCategory.description
      ? t(currentCategory.description)
      : t("B2B-каталог DC Bakery: раздел ${category}.", {
          category: categoryName.toLowerCase(),
        }),
    alternates: buildAlternates(`/catalog/${category}`, locale),
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

  return (
    <main className="min-h-screen bg-cream text-dark">
      <JsonLd data={breadcrumbJsonLd} />
      <section className="mx-auto max-w-7xl px-5 py-10 lg:px-8 lg:py-14">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-sm font-bold uppercase text-raspberry">{t("Каталог")}</p>
            <h1 className="mt-3 text-3xl font-bold leading-tight tracking-tight sm:text-4xl lg:text-5xl">
              {t(currentCategory.name)}
            </h1>
            {currentCategory.description ? (
              <p className="mt-4 max-w-2xl text-base font-semibold leading-7 text-muted">
                {t(currentCategory.description)}
              </p>
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
