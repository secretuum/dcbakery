import type { Metadata } from "next";
import { CategoryNavBar } from "@/src/components/catalog/CategoryNavBar";
import { ProductCard } from "@/src/components/catalog/ProductCard";
import { fetchCategories, fetchProducts } from "@/src/lib/catalog";

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
    <main className="min-h-screen bg-cream text-dark">
      <CategoryNavBar categories={categories} popularCount={popularProducts.length} />

      <section className="mx-auto max-w-7xl px-5 py-10 lg:px-8 lg:py-14">
        <div className="flex flex-col gap-14">
          {popularProducts.length > 0 && (
            <div>
              <h2
                id="cat-popular"
                className="mb-6 text-3xl font-black tracking-tight text-dark"
              >
                Популярное
              </h2>
              <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {popularProducts.map((product) => (
                  <ProductCard key={product.id} product={product} />
                ))}
              </div>
            </div>
          )}
          {categories.map((category) => {
            const categoryProducts = products.filter((p) => p.category_id === category.id);
            if (categoryProducts.length === 0) return null;
            return (
              <div key={category.id}>
                <h2
                  id={`cat-${category.slug}`}
                  className="mb-6 text-3xl font-black tracking-tight text-dark"
                >
                  {category.name}
                </h2>
                <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                  {categoryProducts.map((product) => (
                    <ProductCard key={product.id} product={product} />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </main>
  );
}
