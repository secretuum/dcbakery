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

  const itemClass =
    "relative shrink-0 whitespace-nowrap pb-1.5 font-display font-bold tracking-[-0.02em] transition-colors";

  return (
    <div className="sticky top-16 z-30 border-b border-black/10 bg-cream/85 backdrop-blur-xl backdrop-saturate-150 lg:top-[72px]">
      <div className="mx-auto w-full max-w-7xl px-5 lg:px-8">
        <nav
          aria-label={t("Разделы каталога")}
          className="no-scrollbar flex gap-6 overflow-x-auto whitespace-nowrap py-4"
          style={{ scrollSnapType: "x proximity" }}
        >
          {popularCount && popularCount > 0 ? (
            <button
              onClick={() => scrollTo("popular")}
              aria-current="page"
              className={`${itemClass} text-dark`}
              style={{ fontSize: "clamp(20px,3.4vw,26px)", scrollSnapAlign: "start" }}
            >
              {t("Популярное")}
              <span
                aria-hidden
                className="absolute bottom-0 left-0 h-1 rounded-full bg-coral"
                style={{ width: 26 }}
              />
            </button>
          ) : null}
          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => scrollTo(cat.slug)}
              className={`${itemClass} text-muted-light hover:text-ink-soft`}
              style={{ fontSize: "clamp(20px,3.4vw,26px)", scrollSnapAlign: "start" }}
            >
              {t(cat.name)}
            </button>
          ))}
        </nav>
      </div>
    </div>
  );
}
