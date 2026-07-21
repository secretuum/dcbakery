import type { Metadata } from "next";
import { CategoryNavBar } from "@/src/components/catalog/CategoryNavBar";
import { CatalogFilters } from "@/src/components/catalog/CatalogFilters";
import { fetchCategories, fetchProducts } from "@/src/lib/catalog";
import { fetchProductOrderCounts } from "@/src/lib/supabase/popularity";

export const metadata: Metadata = {
  title: "Каталог | DC Bakery",
  description: "B2B-каталог DC Bakery: десерты, полуфабрикаты и мясо.",
  alternates: { canonical: "/catalog" },
};

export default async function CatalogPage() {
  const [categories, products, orderCounts] = await Promise.all([
    fetchCategories(),
    fetchProducts(),
    fetchProductOrderCounts(),
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

  return (
    <main className="min-h-screen bg-cream text-dark">
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
