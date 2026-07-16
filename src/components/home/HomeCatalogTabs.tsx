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
    <section className="border-t border-black/10 bg-cream px-5 py-14 lg:px-8 lg:py-20">
      <div className="mx-auto max-w-7xl">
        {/* Section header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <h2 className="font-display text-3xl font-bold tracking-tight text-dark lg:text-4xl">
            Каталог продукции
          </h2>
          <Link
            href="/catalog"
            className="text-sm font-semibold text-coral transition hover:text-coral-hover"
          >
            Весь каталог →
          </Link>
        </div>

        {/* Tabs */}
        <div className="no-scrollbar mt-7 flex overflow-x-auto border-b border-black/10">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`shrink-0 border-b-2 pb-3 pr-6 text-sm font-semibold whitespace-nowrap transition ${
                activeTab === tab.id
                  ? "border-dark text-dark"
                  : "border-transparent text-muted hover:text-dark"
              }`}
            >
              {tab.name}
            </button>
          ))}
        </div>

        {/* Product grid — key forces remount on tab switch, triggering stagger animation */}
        <div key={activeTab} className="product-grid mt-7 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {filtered.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
          {filtered.length === 0 && (
            <p className="col-span-full py-16 text-center text-muted">
              В этой категории нет товаров
            </p>
          )}
        </div>

        <div className="mt-8 text-center">
          <Link
            href="/catalog"
            className="inline-block border border-dark px-6 py-2.5 text-sm font-semibold text-dark transition hover:bg-dark hover:text-white"
          >
            Смотреть все товары
          </Link>
        </div>
      </div>
    </section>
  );
}
