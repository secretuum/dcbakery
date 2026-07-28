"use client";

import { useT } from "@/src/i18n/client";
import type { Category } from "@/src/types";

type Props = {
  categories: Category[];
  popularCount?: number;
};

export function CategoryNavBar({ categories, popularCount }: Props) {
  const t = useT();
  function scrollTo(slug: string) {
    document.getElementById(`cat-${slug}`)?.scrollIntoView({ behavior: "smooth" });
  }

  const chipClass =
    "shrink-0 rounded-full bg-cream-deep px-4 py-2 text-sm font-semibold text-ink-soft transition hover:bg-coral-light hover:text-coral active:scale-95";

  return (
    <div className="sticky top-16 z-30 border-b border-black/10 bg-cream/85 backdrop-blur-xl lg:top-[72px]">
      <div className="mx-auto max-w-7xl px-5 lg:px-8">
        <div className="no-scrollbar flex gap-2 overflow-x-auto whitespace-nowrap py-2.5">
          {popularCount && popularCount > 0 ? (
            <button onClick={() => scrollTo("popular")} className={chipClass}>
              {t("Популярное")}
            </button>
          ) : null}
          {categories.map((cat) => (
            <button key={cat.id} onClick={() => scrollTo(cat.slug)} className={chipClass}>
              {t(cat.name)}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
