import type { Metadata } from "next";
import { CategoryNavBar } from "@/src/components/catalog/CategoryNavBar";
import { CatalogFilters } from "@/src/components/catalog/CatalogFilters";
import { PromoBanner } from "@/src/components/catalog/PromoBanner";
import { fetchCategories, fetchProducts } from "@/src/lib/catalog";
import { fetchProductOrderCounts } from "@/src/lib/supabase/popularity";
import { getLocale, getT } from "@/src/i18n/server";
import { localizeProduct } from "@/src/i18n/product";
import { JsonLd } from "@/src/components/seo/JsonLd";
import { buildItemListJsonLd } from "@/src/components/seo/item-list";
import { buildPageMetadata, pageUrl } from "@/src/components/seo/page-metadata";
import { SITE_URL } from "@/src/lib/site-url";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  const t = await getT();
  const title = t("Каталог");
  const description = t("B2B-каталог DC Bakery: десерты, полуфабрикаты и мясо.");

  return {
    // Разделитель «| DC Bakery» держим в коде, а не в ключе словаря
    title: `${title} | DC Bakery`,
    description,
    // og:title остаётся без «| DC Bakery»: бренд несёт og:site_name.
    ...buildPageMetadata({ path: "/catalog", locale, title, description }),
  };
}

export default async function CatalogPage() {
  const [categories, products, orderCounts, locale, t] = await Promise.all([
    fetchCategories(),
    fetchProducts(),
    fetchProductOrderCounts(),
    getLocale(),
    getT(),
  ]);
  // Популярное: сначала реальные заказы, при равенстве — ручной ранг из админки
  const popularProducts = products
    .filter((p) => (orderCounts[p.id] ?? 0) > 0 || (p.popularity_rank ?? 0) > 0)
    .sort(
      (a, b) =>
        (orderCounts[b.id] ?? 0) - (orderCounts[a.id] ?? 0) ||
        (b.popularity_rank ?? 0) - (a.popularity_rank ?? 0),
    )
    .slice(0, 8);

  // Перечень товаров каталога для поиска и ИИ-ассистентов: без ItemList страница
  // выглядит для них сплошным текстом, а не списком позиций со ссылками.
  const itemListJsonLd = buildItemListJsonLd({
    name: t("Каталог DC Bakery"),
    url: pageUrl("/catalog", locale),
    items: products.map((product) => ({
      name: localizeProduct(product, locale).name,
      url: `${SITE_URL}/${locale}/product/${product.slug}`,
    })),
  });

  return (
    <main className="min-h-screen bg-cream text-dark">
      <JsonLd data={itemListJsonLd} />
      <PromoBanner />
      <CategoryNavBar categories={categories} popularCount={popularProducts.length} />
      <CatalogFilters
        categories={categories}
        products={products}
        popularProducts={popularProducts}
        orderCounts={orderCounts}
      />
    </main>
  );
}
