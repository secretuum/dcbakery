import type { Metadata } from "next";
import Link from "next/link";
import { CategoryCard } from "@/src/components/catalog/CategoryCard";
import { CategoryNavBar } from "@/src/components/catalog/CategoryNavBar";
import { fetchCategories, fetchProducts } from "@/src/lib/catalog";

export const metadata: Metadata = {
  title: "Каталог | DC Bakery",
  description: "B2B-каталог DC Bakery: десерты, полуфабрикаты и мясо для бизнеса.",
};

export default async function CatalogPage() {
  const [categories, products] = await Promise.all([fetchCategories(), fetchProducts()]);

  function countProducts(categoryId: string) {
    return products.filter((product) => product.category_id === categoryId).length;
  }

  return (
    <main className="min-h-screen bg-cream text-dark">
      <CategoryNavBar categories={categories} />

      <section className="mx-auto max-w-7xl px-5 py-10 lg:px-8 lg:py-14">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-sm font-black uppercase text-raspberry">Каталог DC Bakery</p>
            <h1 className="mt-3 text-5xl font-black leading-tight tracking-tight sm:text-6xl">
              Выберите раздел закупки
            </h1>
            <p className="mt-4 max-w-2xl text-base font-semibold leading-7 text-muted">
              Пока каталог работает на локальных mock-данных. На следующем этапе эти helpers можно
              заменить на Supabase без изменения карточек и страниц.
            </p>
          </div>

          <Link
            href="/#terms"
            className="inline-flex min-h-12 items-center justify-center rounded-btn bg-white px-5 py-3 text-sm font-black text-dark shadow-sm transition hover:bg-coral-light"
          >
            Условия заказа
          </Link>
        </div>

        <div className="mt-10 grid gap-5 md:grid-cols-3">
          {categories.map((category) => (
            <div key={category.id} id={`cat-${category.slug}`}>
              <CategoryCard
                category={category}
                eyebrow={`${countProducts(category.id)} товаров`}
              />
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
