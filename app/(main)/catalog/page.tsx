import type { Metadata } from "next";
import { CategoryNavBar } from "@/src/components/catalog/CategoryNavBar";
import { CatalogFilters } from "@/src/components/catalog/CatalogFilters";
import { fetchCategories, fetchProducts } from "@/src/lib/catalog";
import { CatalogShapes } from "@/src/components/ui/DecorativeShapes";

export const metadata: Metadata = {
  title: "Каталог | DC Bakery",
  description: "B2B-каталог DC Bakery: десерты, полуфабрикаты и мясо.",
};

export default async function CatalogPage() {
  const [categories, products] = await Promise.all([fetchCategories(), fetchProducts()]);
  const popularProducts = products
    .filter((p) => (p.popularity_rank ?? 0) > 0)
    .sort((a, b) => (b.popularity_rank ?? 0) - (a.popularity_rank ?? 0))
    .slice(0, 8);

  return (
    <main className="relative min-h-screen overflow-hidden bg-cream text-dark">
      <CatalogShapes />
      <CategoryNavBar categories={categories} popularCount={popularProducts.length} />
      <CatalogFilters
        categories={categories}
        products={products}
        popularProducts={popularProducts}
      />
    </main>
  );
}
