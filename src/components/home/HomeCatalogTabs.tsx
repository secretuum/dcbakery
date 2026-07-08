"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { ProductCard } from "@/src/components/catalog/ProductCard";
import type { Category, Product } from "@/src/types";

type Props = {
  categories: Category[];
  products: Product[];
};

const MAX_VISIBLE = 8;

type Tab = { id: string; name: string };

export function HomeCatalogTabs({ categories, products }: Props) {
  const [activeTab, setActiveTab] = useState<string>("all");

  const tabs: Tab[] = [{ id: "all", name: "Все продукты" }, ...categories];

  const filtered = useMemo(() => {
    if (activeTab === "all") return products.slice(0, MAX_VISIBLE);
    return products.filter((p) => p.category_id === activeTab).slice(0, MAX_VISIBLE);
  }, [activeTab, products]);

  return (
    <section className="border-t border-fudo-border px-5 py-16 lg:px-8 lg:py-24">
      <div className="mx-auto max-w-7xl">
        {/* Section header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <h2 className="font-serif text-3xl font-bold text-fudo-dark lg:text-4xl">
            Каталог продукции
          </h2>
          <Link
            href="/catalog"
            className="flex items-center gap-1 text-sm font-medium text-fudo-accent transition hover:opacity-75"
          >
            Смотреть весь каталог →
          </Link>
        </div>

        {/* Tabs */}
        <div className="no-scrollbar mt-8 flex overflow-x-auto border-b border-fudo-border">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`shrink-0 border-b-2 pb-3 pr-6 text-sm font-medium whitespace-nowrap transition ${
                activeTab === tab.id
                  ? "border-fudo-accent text-fudo-accent"
                  : "border-transparent text-fudo-muted hover:text-fudo-dark"
              }`}
            >
              {tab.name}
            </button>
          ))}
        </div>

        {/* Product grid */}
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {filtered.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
          {filtered.length === 0 && (
            <p className="col-span-full py-16 text-center text-fudo-muted">
              В этой категории нет товаров
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
