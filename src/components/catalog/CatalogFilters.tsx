"use client";

import { useMemo, useState } from "react";
import type { Category, Product } from "@/src/types";
import { formatPrice } from "@/src/lib/format";
import { useT } from "@/src/i18n/client";
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
  const t = useT();
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

  // Count shown under the toolbar: filtered length while filtering, else all products.
  const shownCount = isFiltering ? filtered.length : products.length;

  // The mobile filter badge counts distinct active filter groups.
  const activeFilterCount =
    selectedCategories.length +
    (inStockOnly ? 1 : 0) +
    (priceMin !== "" || priceMax !== "" ? 1 : 0);

  const sidebarGroups = (
    <>
      {/* Categories */}
      <div className="border-b border-black/10 py-5 first:pt-0">
        <p className="mb-3 text-[13.5px] font-bold text-dark">{t("Категории")}</p>
        <div className="space-y-2">
          {categories.map((cat) => (
            <label key={cat.id} className="flex cursor-pointer items-center gap-2">
              <input
                type="checkbox"
                checked={selectedCategories.includes(cat.id)}
                onChange={() => toggleCategory(cat.id)}
                className="h-4 w-4 accent-coral"
              />
              <span className="text-[15px] font-semibold text-dark">{t(cat.name)}</span>
            </label>
          ))}
        </div>
      </div>

      {/* Stock */}
      <div className="border-b border-black/10 py-5">
        <p className="mb-3 text-[13.5px] font-bold text-dark">{t("Наличие")}</p>
        <label className="flex cursor-pointer items-center gap-2">
          <input
            type="checkbox"
            checked={inStockOnly}
            onChange={(e) => setInStockOnly(e.target.checked)}
            className="h-4 w-4 accent-coral"
          />
          <span className="text-[15px] font-semibold text-dark">{t("Только в наличии")}</span>
        </label>
      </div>

      {/* Price */}
      <div className="border-b border-black/10 py-5 last:border-b-0 last:pb-0">
        <p className="mb-3 text-[13.5px] font-bold text-dark">{t("Цена")}</p>
        <input
          type="range"
          min={0}
          max={maxProductPrice || 100000}
          value={priceMax !== "" ? Number(priceMax) : (maxProductPrice || 100000)}
          onChange={(e) => setPriceMax(e.target.value)}
          className="w-full accent-coral"
        />
        <div className="mt-3 flex gap-2">
          <input
            type="number"
            value={priceMin}
            onChange={(e) => setPriceMin(e.target.value)}
            placeholder={t("от")}
            className="min-h-11 w-full rounded-md border border-black/10 bg-white px-3 text-center text-[15px] text-dark placeholder-muted-light outline-none transition focus:border-coral focus:ring-2 focus:ring-coral/15"
          />
          <input
            type="number"
            value={priceMax}
            onChange={(e) => setPriceMax(e.target.value)}
            placeholder={t("до")}
            className="min-h-11 w-full rounded-md border border-black/10 bg-white px-3 text-center text-[15px] text-dark placeholder-muted-light outline-none transition focus:border-coral focus:ring-2 focus:ring-coral/15"
          />
        </div>
        {(priceMin !== "" || priceMax !== "") && (
          <p className="mt-2 text-[13.5px] text-muted">
            {priceMin !== "" ? formatPrice(Number(priceMin)) : "0"} —{" "}
            {priceMax !== "" ? formatPrice(Number(priceMax)) : t("без ограничений")}
          </p>
        )}
      </div>
    </>
  );

  // Shared head row (title + optional reset) used by both desktop panel and mobile sheet.
  const sidebarHead = (
    <div className="flex items-center justify-between border-b border-black/10 pb-4">
      <h2 className="text-[11px] font-bold uppercase tracking-[0.12em] text-muted">
        {t("Фильтры")}
      </h2>
      {hasActiveFilters && (
        <button
          type="button"
          onClick={resetFilters}
          className="text-[13.5px] font-bold text-coral hover:text-coral-hover"
        >
          {t("Сбросить всё")}
        </button>
      )}
    </div>
  );

  const productGrid = (products: Product[]) => (
    <div className="product-grid grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 xl:grid-cols-4">
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
          className="fixed inset-0 z-40 bg-black/40 lg:hidden"
          onClick={() => setIsMobileOpen(false)}
        />
      )}

      {/* Mobile bottom sheet */}
      <div
        className="fixed inset-x-0 bottom-0 z-50 flex max-h-[92vh] flex-col rounded-t-3xl bg-cream shadow-xl transition-transform duration-300 lg:hidden"
        style={{ transform: isMobileOpen ? "translateY(0)" : "translateY(100%)" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* grip */}
        <div className="flex justify-center pt-3">
          <span className="h-1 w-[42px] rounded-full bg-black/20" />
        </div>

        {/* head */}
        <div className="flex items-center justify-between px-5 pt-3 pb-4">
          <span className="text-[17px] font-bold text-dark">{t("Фильтры")}</span>
          <div className="flex items-center gap-3">
            {hasActiveFilters && (
              <button
                type="button"
                onClick={resetFilters}
                className="text-[13.5px] font-bold text-coral hover:text-coral-hover"
              >
                {t("Сбросить всё")}
              </button>
            )}
            <button
              type="button"
              onClick={() => setIsMobileOpen(false)}
              className="flex h-9 w-9 items-center justify-center rounded-full border border-black/10 bg-white text-dark hover:bg-black/5"
              aria-label={t("Закрыть")}
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 6l12 12M18 6L6 18" />
              </svg>
            </button>
          </div>
        </div>

        {/* scrollable body */}
        <div className="min-h-0 flex-1 overflow-y-auto px-5">
          {sidebarGroups}
        </div>

        {/* sticky footer */}
        <div className="border-t border-black/10 bg-cream p-5">
          <button
            type="button"
            onClick={() => setIsMobileOpen(false)}
            className="w-full rounded-full bg-coral py-3.5 text-[15px] font-bold text-white transition-colors hover:bg-coral-hover"
          >
            {t("Показать")} {shownCount}
          </button>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-5 py-10 lg:flex lg:gap-8 lg:px-8 lg:py-14">
        {/* Desktop sidebar */}
        <aside className="hidden w-60 shrink-0 lg:block">
          <div className="sticky top-[88px] rounded-xl bg-white p-5 shadow-xs">
            {sidebarHead}
            {sidebarGroups}
          </div>
        </aside>

        <div className="flex-1 min-w-0">
          {/* Search + sort + mobile filter button */}
          <div className="mb-3 flex flex-wrap gap-3 sm:grid sm:grid-cols-[1fr_auto_auto] sm:items-center">
            <div className="relative min-w-40 flex-1">
              <svg
                className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted-light"
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
                placeholder={t("Найти товар...")}
                className="w-full rounded-full border-[1.5px] border-black/10 bg-white py-3 pl-11 pr-9 text-[15px] text-dark placeholder-muted-light outline-none transition focus:border-coral focus:ring-4 focus:ring-coral/15"
              />
              {query && (
                <button
                  onClick={() => setQuery("")}
                  aria-label={t("Очистить")}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-light hover:text-dark"
                >
                  ✕
                </button>
              )}
            </div>
            <select
              value={sortMode}
              onChange={(e) => setSortMode(e.currentTarget.value as SortMode)}
              aria-label={t("Сортировка")}
              className="min-w-[190px] rounded-full border-[1.5px] border-black/10 bg-white px-4 py-3 text-[15px] font-semibold text-dark outline-none transition focus:border-coral focus:ring-4 focus:ring-coral/15"
            >
              {sortOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {t(option.label)}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => setIsMobileOpen(true)}
              className="flex items-center gap-2 rounded-full border border-black/10 bg-white px-4 py-3 text-[15px] font-bold text-dark lg:hidden"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 4h18M7 12h10M11 20h2" />
              </svg>
              {t("Фильтры")}
              {hasActiveFilters && (
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-coral text-[11px] font-bold text-white">
                  {activeFilterCount}
                </span>
              )}
            </button>
          </div>

          {/* Count line */}
          <p className="mb-6 text-[13.5px] text-muted">
            {t("Найдено")} <b className="font-bold text-dark">{shownCount}</b> {t("позиции")}
          </p>

          {/* Products */}
          {isFiltering ? (
            filtered.length === 0 ? (
              <p className="py-10 text-muted">{t("Ничего не найдено по выбранным фильтрам")}</p>
            ) : (
              productGrid(filtered)
            )
          ) : (
            <div className="flex flex-col gap-14">
              {popularProducts.length > 0 && (
                <div>
                  <h2
                    id="cat-popular"
                    className="mb-6 font-display font-bold tracking-[-0.02em] text-dark"
                    style={{ fontSize: "clamp(24px,3vw,34px)" }}
                  >
                    {t("Популярное")}
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
                      className="mb-6 font-display font-bold tracking-[-0.02em] text-dark"
                      style={{ fontSize: "clamp(24px,3vw,34px)" }}
                    >
                      {t(category.name)}
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
