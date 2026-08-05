"use client";

import { useState, useMemo } from "react";
import { LocaleLink as Link } from "@/src/i18n/LocaleLink";
import { ProductCard } from "@/src/components/catalog/ProductCard";
import { useT } from "@/src/i18n/client";
import { EditableText } from "@/src/components/home/SiteEditMode";
import type { Category, Product } from "@/src/types";

type Props = {
  categories: Category[];
  products: Product[];
};

const MAX_VISIBLE = 8;

type Tab = { id: string; name: string };

export function HomeCatalogTabs({ categories, products }: Props) {
  const t = useT();
  const [activeTab, setActiveTab] = useState<string>("all");

  const tabs: Tab[] = [{ id: "all", name: "Все продукты" }, ...categories];

  const filtered = useMemo(() => {
    if (activeTab === "all") return products.slice(0, MAX_VISIBLE);
    return products.filter((p) => p.category_id === activeTab).slice(0, MAX_VISIBLE);
  }, [activeTab, products]);

  return (
    <section className="bg-cream px-5 py-14 lg:px-8 lg:py-20">
      <div className="mx-auto max-w-7xl">
        {/* Section header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <h2 className="font-display text-3xl font-extrabold tracking-tight text-dark lg:text-4xl">
            <EditableText field="home.catalog.title" fallback={t("Каталог продукции")} />
          </h2>
          <Link
            href="/catalog"
            className="text-sm font-semibold text-coral transition hover:text-coral-hover"
          >
            <EditableText field="home.catalog.viewAll" fallback={t("Весь каталог →")} />
          </Link>
        </div>

        {/* Tabs */}
        <div className="no-scrollbar mt-7 flex gap-1 overflow-x-auto rounded-full bg-cream-deep p-1">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`shrink-0 whitespace-nowrap rounded-full px-4 py-2 text-sm font-semibold transition ${
                activeTab === tab.id
                  ? "bg-white text-dark shadow-sm"
                  : "text-muted hover:text-dark"
              }`}
            >
              {tab.id === "all" ? (
                <EditableText field="home.catalog.tabAll" fallback={t(tab.name)} />
              ) : (
                t(tab.name)
              )}
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
              <EditableText field="home.catalog.empty" fallback={t("В этой категории нет товаров")} />
            </p>
          )}
        </div>

        <div className="mt-8 text-center">
          <Link
            href="/catalog"
            className="inline-flex min-h-12 items-center rounded-full border border-black/15 bg-white px-6 text-[15px] font-semibold text-dark transition hover:border-coral hover:text-coral active:scale-[.98]"
          >
            <EditableText field="home.catalog.seeAllBtn" fallback={t("Смотреть все товары")} />
          </Link>
        </div>
      </div>
    </section>
  );
}
