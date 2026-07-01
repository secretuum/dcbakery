"use client";

import { useState, useEffect, useRef } from "react";
import type { Product, Category } from "@/src/types";
import { ProductCard } from "./ProductCard";

type Props = {
  products: Product[];
  categories: Category[];
  popularProducts: Product[];
};

export function CatalogSearch({ products, categories, popularProducts }: Props) {
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    timerRef.current = setTimeout(() => setDebouncedQuery(query), 300);
    return () => clearTimeout(timerRef.current);
  }, [query]);

  const isSearching = debouncedQuery.length > 0;
  const filtered = isSearching
    ? products.filter((p) =>
        p.name.toLowerCase().includes(debouncedQuery.toLowerCase())
      )
    : [];

  return (
    <section className="mx-auto max-w-7xl px-5 py-10 lg:px-8 lg:py-14">
      <div className="relative mb-8 max-w-md">
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
          className="w-full rounded-xl border border-gray-200 bg-white py-2.5 pl-10 pr-10 text-sm text-dark placeholder-gray-400 shadow-sm outline-none focus:border-coral focus:ring-2 focus:ring-coral/20"
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

      {isSearching ? (
        <div>
          {filtered.length === 0 ? (
            <p className="text-gray-500">
              Ничего не найдено по запросу «{debouncedQuery}»
            </p>
          ) : (
            <div className="grid gap-3 grid-cols-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
              {filtered.map((p) => (
                <ProductCard key={p.id} product={p} />
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-14">
          {popularProducts.length > 0 && (
            <div>
              <h2
                id="cat-popular"
                className="mb-6 text-3xl font-black tracking-tight text-dark"
              >
                Популярное
              </h2>
              <div className="grid gap-3 grid-cols-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
                {popularProducts.map((p) => (
                  <ProductCard key={p.id} product={p} />
                ))}
              </div>
            </div>
          )}
          {categories.map((category) => {
            const categoryProducts = products.filter(
              (p) => p.category_id === category.id
            );
            if (categoryProducts.length === 0) return null;
            return (
              <div key={category.id}>
                <h2
                  id={`cat-${category.slug}`}
                  className="mb-6 text-3xl font-black tracking-tight text-dark"
                >
                  {category.name}
                </h2>
                <div className="grid gap-3 grid-cols-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
                  {categoryProducts.map((p) => (
                    <ProductCard key={p.id} product={p} />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
