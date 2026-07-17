"use client";

import { useMemo, useState } from "react";
import type { Category, Product } from "@/src/types";
import { formatPrice } from "@/src/lib/format";
import { ProductCard } from "./ProductCard";

type Props = {
  categories: Category[];
  products: Product[];
  popularProducts: Product[];
  orderCounts?: Record<string, number>;
};

type SortMode = "default" | "popular" | "price_asc" | "price_desc";

const sortOptions: Array<{ value: SortMode; label: string }> = [
  { value: "default", label: "По умолчанию" },
  { value: "popular", label: "По популярности" },
  { value: "price_asc", label: "Цена: по возрастанию" },
  { value: "price_desc", label: "Цена: по убыванию" },
];

export function CatalogFilters({ categories, products, popularProducts, orderCounts = {} }: Props) {
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [inStockOnly, setInStockOnly] = useState(false);
  const [priceMin, setPriceMin] = useState("");
  const [priceMax, setPriceMax] = useState("");
  const [query, setQuery] = useState("");
  const [sortMode, setSortMode] = useState<SortMode>("default");

  const maxProductPrice = useMemo(
    () => Math.max(...products.map((p) => p.price), 0),
    [products],
  );

  const hasActiveFilters =
    selectedCategories.length > 0 || inStockOnly || priceMin !== "" || priceMax !== "";

  function toggleCategory(id: string) {
    setSelectedCategories((prev) =>
      prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id],
    );
  }

  function resetFilters() {
    setSelectedCategories([]);
    setInStockOnly(false);
    setPriceMin("");
    setPriceMax("");
  }

  const filtered = useMemo(() => {
    const min = priceMin !== "" ? Number(priceMin) : null;
    const max = priceMax !== "" ? Number(priceMax) : null;
    const q = query.trim().toLowerCase();

    const result = products.filter((p) => {
      if (selectedCategories.length > 0 && !selectedCategories.includes(p.category_id)) return false;
      if (inStockOnly && p.stock_qty <= 0) return false;
      if (min !== null && p.price < min) return false;
      if (max !== null && p.price > max) return false;
      if (q && !p.name.toLowerCase().includes(q)) return false;
      return true;
    });

    if (sortMode === "price_asc") {
      result.sort((a, b) => a.price - b.price);
    } else if (sortMode === "price_desc") {
      result.sort((a, b) => b.price - a.price);
    } else if (sortMode === "popular") {
      // Сначала реально заказанные (сумма заказанных единиц), потом ручной ранг
      result.sort(
        (a, b) =>
          (orderCounts[b.id] ?? 0) - (orderCounts[a.id] ?? 0) ||
          (b.popularity_rank ?? 0) - (a.popularity_rank ?? 0) ||
          a.sort_order - b.sort_order,
      );
    }

    return result;
  }, [products, selectedCategories, inStockOnly, priceMin, priceMax, query, sortMode, orderCounts]);

  const isFiltering = hasActiveFilters || query.trim().length > 0 || sortMode !== "default";

  const sidebar = (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-bold uppercase text-dark">Фильтры</h2>
        {hasActiveFilters && (
          <button
            type="button"
            onClick={resetFilters}
            className="text-xs font-bold text-coral hover:text-coral-hover"
          >
            Сбросить всё
          </button>
        )}
      </div>

      {/* Categories */}
      <div>
        <p className="mb-3 text-xs font-bold uppercase text-muted">Категории</p>
        <div className="space-y-2">
          {categories.map((cat) => (
            <label key={cat.id} className="flex cursor-pointer items-center gap-2">
              <input
                type="checkbox"
                checked={selectedCategories.includes(cat.id)}
                onChange={() => toggleCategory(cat.id)}
                className="h-4 w-4 accent-coral"
              />
              <span className="text-sm font-semibold text-dark">{cat.name}</span>
            </label>
          ))}
        </div>
      </div>

      {/* Stock */}
      <div>
        <p className="mb-3 text-xs font-bold uppercase text-muted">Наличие</p>
        <label className="flex cursor-pointer items-center gap-2">
          <input
            type="checkbox"
            checked={inStockOnly}
            onChange={(e) => setInStockOnly(e.target.checked)}
            className="h-4 w-4 accent-coral"
          />
          <span className="text-sm font-semibold text-dark">Только в наличии</span>
        </label>
      </div>

      {/* Price */}
      <div>
        <p className="mb-3 text-xs font-bold uppercase text-muted">Цена</p>
        <input
          type="range"
          min={0}
          max={maxProductPrice || 100000}
          value={priceMax !== "" ? Number(priceMax) : (maxProductPrice || 100000)}
          onChange={(e) => setPriceMax(e.target.value)}
          className="w-full accent-coral"
        />
        <div className="mt-2 flex gap-2">
          <input
            type="number"
            value={priceMin}
            onChange={(e) => setPriceMin(e.target.value)}
            placeholder="от"
            className="w-full rounded border border-black/10 bg-white px-3 py-1.5 text-sm text-dark placeholder-muted outline-none focus:border-coral focus:ring-1 focus:ring-coral/20"
          />
          <input
            type="number"
            value={priceMax}
            onChange={(e) => setPriceMax(e.target.value)}
            placeholder="до"
            className="w-full rounded border border-black/10 bg-white px-3 py-1.5 text-sm text-dark placeholder-muted outline-none focus:border-coral focus:ring-1 focus:ring-coral/20"
          />
        </div>
        {(priceMin !== "" || priceMax !== "") && (
          <p className="mt-1.5 text-xs text-muted">
            {priceMin !== "" ? formatPrice(Number(priceMin)) : "0"} —{" "}
            {priceMax !== "" ? formatPrice(Number(priceMax)) : "без ограничений"}
          </p>
        )}
      </div>
    </div>
  );

  const productGrid = (products: Product[]) => (
    <div className="product-grid grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
      {products.map((p) => (
        <ProductCard key={p.id} product={p} />
      ))}
    </div>
  );

  return (
    <>
      {/* Mobile backdrop */}
      {isMobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/40"
          onClick={() => setIsMobileOpen(false)}
        />
      )}

      {/* Mobile slide-in panel */}
      <div
        className="fixed inset-y-0 left-0 z-50 flex w-72 flex-col overflow-y-auto bg-white p-5 shadow-xl transition-transform duration-300 lg:hidden"
        style={{ transform: isMobileOpen ? "translateX(0)" : "translateX(-100%)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <span className="font-bold text-dark">Фильтры</span>
          <button
            type="button"
            onClick={() => setIsMobileOpen(false)}
            className="flex h-8 w-8 items-center justify-center border border-black/10 bg-white text-dark hover:bg-black/5"
            aria-label="Закрыть"
          >
            ✕
          </button>
        </div>
        {sidebar}
        {hasActiveFilters && (
          <button
            type="button"
            onClick={() => { resetFilters(); setIsMobileOpen(false); }}
            className="mt-6 w-full rounded bg-dark py-2.5 text-sm font-bold text-white"
          >
            Сбросить и закрыть
          </button>
        )}
      </div>

      <div className="mx-auto max-w-7xl px-5 py-10 lg:flex lg:gap-8 lg:px-8 lg:py-14">
        {/* Desktop sidebar */}
        <aside className="hidden w-60 shrink-0 lg:block">
          {sidebar}
        </aside>

        <div className="flex-1 min-w-0">
          {/* Search + sort + mobile filter button */}
          <div className="mb-6 flex flex-wrap gap-3">
            <div className="relative min-w-40 flex-1 max-w-md">
              <svg
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Найти товар..."
                className="w-full rounded border border-black/10 bg-white py-2.5 pl-10 pr-8 text-sm text-dark placeholder-gray-400 outline-none focus:border-coral focus:ring-1 focus:ring-coral/20"
              />
              {query && (
                <button
                  onClick={() => setQuery("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-dark"
                >
                  ✕
                </button>
              )}
            </div>
            <select
              value={sortMode}
              onChange={(e) => setSortMode(e.currentTarget.value as SortMode)}
              aria-label="Сортировка"
              className="rounded border border-black/10 bg-white px-3 py-2.5 text-sm font-semibold text-dark outline-none focus:border-coral focus:ring-1 focus:ring-coral/20"
            >
              {sortOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => setIsMobileOpen(true)}
              className="flex items-center gap-2 rounded border border-black/10 bg-white px-4 py-2.5 text-sm font-bold text-dark lg:hidden"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 4h18M7 12h10M11 20h2" />
              </svg>
              Фильтры
              {hasActiveFilters && (
                <span className="flex h-5 w-5 items-center justify-center bg-coral text-[10px] font-bold text-white">
                  {selectedCategories.length + (inStockOnly ? 1 : 0) + (priceMin !== "" || priceMax !== "" ? 1 : 0)}
                </span>
              )}
            </button>
          </div>

          {/* Products */}
          {isFiltering ? (
            filtered.length === 0 ? (
              <p className="py-10 text-gray-500">Ничего не найдено по выбранным фильтрам</p>
            ) : (
              productGrid(filtered)
            )
          ) : (
            <div className="flex flex-col gap-14">
              {popularProducts.length > 0 && (
                <div>
                  <h2 id="cat-popular" className="mb-6 text-3xl font-bold tracking-tight text-dark">
                    Популярное
                  </h2>
                  {productGrid(popularProducts)}
                </div>
              )}
              {categories.map((category) => {
                const catProducts = products.filter((p) => p.category_id === category.id);
                if (catProducts.length === 0) return null;
                return (
                  <div key={category.id}>
                    <h2
                      id={`cat-${category.slug}`}
                      className="mb-6 text-3xl font-bold tracking-tight text-dark"
                    >
                      {category.name}
                    </h2>
                    {productGrid(catProducts)}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
