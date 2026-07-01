"use client";

import type { Category } from "@/src/types";

type Props = {
  categories: Category[];
  popularCount?: number;
};

export function CategoryNavBar({ categories, popularCount }: Props) {
  function scrollTo(slug: string) {
    document.getElementById(`cat-${slug}`)?.scrollIntoView({ behavior: "smooth" });
  }

  return (
    <div className="sticky top-0 z-40 bg-white shadow-sm">
      <div className="mx-auto max-w-7xl px-5 lg:px-8">
        <div className="flex gap-2 overflow-x-auto whitespace-nowrap py-2 [&::-webkit-scrollbar]:hidden">
          {popularCount && popularCount > 0 ? (
            <button
              onClick={() => scrollTo("popular")}
              className="shrink-0 rounded-badge bg-cream px-4 py-1.5 text-sm font-bold text-dark transition hover:bg-coral-light hover:text-coral active:scale-95"
            >
              Популярное
            </button>
          ) : null}
          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => scrollTo(cat.slug)}
              className="shrink-0 rounded-badge bg-cream px-4 py-1.5 text-sm font-bold text-dark transition hover:bg-coral-light hover:text-coral active:scale-95"
            >
              {cat.name}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
