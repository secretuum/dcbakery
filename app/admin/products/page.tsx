import type { Metadata } from "next";
import Link from "next/link";
import { Badge } from "@/src/components/ui/Badge";
import { FallbackImage } from "@/src/components/ui/FallbackImage";
import { fetchCategories, fetchProducts } from "@/src/lib/catalog";
import { formatProductPrice } from "@/src/lib/format";
import type { Product } from "@/src/types";

type AdminProductsPageProps = {
  searchParams: Promise<{
    category?: string | string[];
    q?: string | string[];
  }>;
};

export const metadata: Metadata = {
  title: "Товары | Админка DC Bakery",
};

function getParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

function buildProductsHref(params: { category?: string; q?: string }) {
  const searchParams = new URLSearchParams();

  if (params.category) {
    searchParams.set("category", params.category);
  }

  if (params.q) {
    searchParams.set("q", params.q);
  }

  const query = searchParams.toString();
  return query ? `/admin/products?${query}` : "/admin/products";
}

function filterProducts(products: Product[], categorySlug: string, query: string) {
  const normalizedQuery = query.trim().toLowerCase();

  return products.filter((product) => {
    const matchesCategory = categorySlug ? product.category?.slug === categorySlug : true;
    const matchesQuery = normalizedQuery
      ? [product.name, product.description, product.subcategory, product.category?.name]
          .filter(Boolean)
          .some((value) => value?.toLowerCase().includes(normalizedQuery))
      : true;

    return matchesCategory && matchesQuery;
  });
}

function getStockTone(stockQty: number) {
  if (stockQty <= 0) {
    return "text-burgundy";
  }

  if (stockQty <= 10) {
    return "text-raspberry";
  }

  return "text-dark";
}

export default async function AdminProductsPage({ searchParams }: AdminProductsPageProps) {
  const [{ category, q }, categories, products] = await Promise.all([
    searchParams,
    fetchCategories(),
    fetchProducts(),
  ]);
  const selectedCategory = getParam(category);
  const query = getParam(q);
  const filteredProducts = filterProducts(products, selectedCategory, query);
  const totalStock = products.reduce((sum, product) => sum + product.stock_qty, 0);
  const pricedProductsCount = products.filter((product) => product.price > 0).length;

  return (
    <div>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-black uppercase text-raspberry">Админка</p>
          <h1 className="mt-2 text-4xl font-black tracking-tight sm:text-5xl">Товары</h1>
          <p className="mt-3 max-w-2xl text-sm font-semibold leading-6 text-muted">
            Каталог сейчас работает на локальном файле products.ts. Этот экран показывает текущую
            витрину и помогает быстро проверить цены, остатки и категории.
          </p>
        </div>
        <Link
          href="/catalog"
          className="inline-flex min-h-11 items-center justify-center rounded-btn bg-white px-4 py-2 text-sm font-black text-muted shadow-sm transition hover:bg-coral-light hover:text-dark"
        >
          Открыть каталог
        </Link>
      </div>

      <section className="mt-7 grid gap-3 sm:grid-cols-3">
        <div className="rounded-card bg-white p-5 shadow-sm">
          <p className="text-xs font-black uppercase text-muted">Всего товаров</p>
          <p className="mt-2 text-3xl font-black">{products.length}</p>
        </div>
        <div className="rounded-card bg-white p-5 shadow-sm">
          <p className="text-xs font-black uppercase text-muted">С указанной ценой</p>
          <p className="mt-2 text-3xl font-black">{pricedProductsCount}</p>
        </div>
        <div className="rounded-card bg-white p-5 shadow-sm">
          <p className="text-xs font-black uppercase text-muted">Остаток всего</p>
          <p className="mt-2 text-3xl font-black">{totalStock}</p>
        </div>
      </section>

      <section className="mt-6 rounded-card bg-white p-5 shadow-[0_18px_60px_rgba(120,51,38,0.10)]">
        <form className="grid gap-3 lg:grid-cols-[1fr_auto]" action="/admin/products">
          {selectedCategory ? <input type="hidden" name="category" value={selectedCategory} /> : null}
          <input
            className="min-h-12 rounded-xl border border-black/10 bg-cream px-4 py-3 text-sm font-bold text-dark outline-none transition placeholder:text-muted focus:border-coral focus:ring-2 focus:ring-coral/25"
            defaultValue={query}
            name="q"
            placeholder="Поиск по названию, описанию или категории"
          />
          <button
            className="min-h-12 rounded-btn bg-dark px-5 py-3 text-sm font-black text-white transition hover:bg-burgundy"
            type="submit"
          >
            Найти
          </button>
        </form>

        <nav className="mt-4 flex gap-2 overflow-x-auto pb-1" aria-label="Фильтр категорий">
          <Link
            href={buildProductsHref({ q: query })}
            className={`shrink-0 rounded-btn px-4 py-2 text-sm font-black transition ${
              selectedCategory ? "bg-cream text-muted hover:bg-coral-light" : "bg-coral text-white"
            }`}
          >
            Все
          </Link>
          {categories.map((categoryItem) => {
            const isActive = selectedCategory === categoryItem.slug;

            return (
              <Link
                key={categoryItem.id}
                href={buildProductsHref({ category: categoryItem.slug, q: query })}
                className={`shrink-0 rounded-btn px-4 py-2 text-sm font-black transition ${
                  isActive ? "bg-coral text-white" : "bg-cream text-muted hover:bg-coral-light"
                }`}
              >
                {categoryItem.name}
              </Link>
            );
          })}
        </nav>
      </section>

      <div className="mt-6 overflow-hidden rounded-card bg-white shadow-[0_18px_60px_rgba(120,51,38,0.10)]">
        {filteredProducts.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="min-w-[960px] w-full border-collapse text-left">
              <thead className="bg-coral-light text-xs font-black uppercase text-burgundy">
                <tr>
                  <th className="px-5 py-4">Товар</th>
                  <th className="px-5 py-4">Категория</th>
                  <th className="px-5 py-4">Цена</th>
                  <th className="px-5 py-4">Вес</th>
                  <th className="px-5 py-4">Остаток</th>
                  <th className="px-5 py-4">Статус</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black/10 text-sm font-semibold">
                {filteredProducts.map((product) => (
                  <tr key={product.id} className="transition hover:bg-cream">
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div className="relative size-16 shrink-0 overflow-hidden rounded-btn bg-coral-light">
                          <FallbackImage
                            alt={product.name}
                            className="object-cover"
                            fill
                            sizes="64px"
                            src={product.images[0]}
                          />
                        </div>
                        <div className="min-w-0">
                          <Link
                            className="font-black text-dark transition hover:text-raspberry"
                            href={`/product/${product.slug}`}
                          >
                            {product.name}
                          </Link>
                          <p className="mt-1 line-clamp-1 max-w-md text-xs text-muted">
                            {product.description}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <Badge variant="burgundy">{product.category?.name ?? "Без категории"}</Badge>
                    </td>
                    <td className="px-5 py-4 font-black text-raspberry">
                      {formatProductPrice(product.price)}
                    </td>
                    <td className="px-5 py-4 text-muted">{product.weightLabel ?? "не указано"}</td>
                    <td className={`px-5 py-4 font-black ${getStockTone(product.stock_qty)}`}>
                      {product.stock_qty}
                    </td>
                    <td className="px-5 py-4">
                      <Badge variant={product.is_active ? "coral" : "dark"}>
                        {product.is_active ? "Активен" : "Скрыт"}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-8 text-center">
            <h2 className="text-3xl font-black">Ничего не найдено</h2>
            <p className="mt-3 text-sm font-semibold text-muted">
              Измените поиск или сбросьте фильтр категории.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
