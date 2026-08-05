"use client";

import { LocaleLink as Link } from "@/src/i18n/LocaleLink";
import { useT } from "@/src/i18n/client";
import { EditableText } from "@/src/components/home/SiteEditMode";

type Category = { id: string; slug: string; name: string };

type Props = {
  categories: Category[];
  counts?: Record<string, number>;
};

export function HomeCatBar({ categories, counts }: Props) {
  const t = useT();

  return (
    <div className="border-b border-black/10 bg-cream/80 backdrop-blur-lg backdrop-saturate-150">
      <div className="mx-auto w-full max-w-7xl px-5 lg:px-8">
        <nav
          aria-label={t("Разделы главной")}
          className="no-scrollbar -mx-5 flex gap-6 overflow-x-auto px-5 py-4 lg:-mx-8 lg:px-8"
          style={{ scrollSnapType: "x proximity" }}
        >
          {/* Первый пункт — «популярное» → весь каталог, всегда активный */}
          <Link
            href="/catalog"
            aria-current="page"
            className="relative shrink-0 whitespace-nowrap pb-1.5 font-display font-bold tracking-[-0.02em] text-dark transition-colors"
            style={{ fontSize: "clamp(20px,3.4vw,26px)", scrollSnapAlign: "start" }}
          >
            <EditableText field="home.catbar.popular" fallback={t("популярное")} />
            <span
              aria-hidden
              className="absolute bottom-0 left-0 h-1 rounded-full bg-coral"
              style={{ width: 26 }}
            />
          </Link>

          {categories.map((cat) => {
            const count = counts?.[cat.id] ?? counts?.[cat.slug];
            return (
              <Link
                key={cat.id}
                href={`/catalog?category=${cat.slug}`}
                className="relative shrink-0 whitespace-nowrap pb-1.5 font-display font-bold tracking-[-0.02em] text-muted-light transition-colors hover:text-ink-soft"
                style={{ fontSize: "clamp(20px,3.4vw,26px)", scrollSnapAlign: "start" }}
              >
                {t(cat.name)}
                {typeof count === "number" && count > 0 && (
                  <span className="ml-[3px] align-super font-sans text-xs font-semibold text-muted-light">
                    {count}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>
      </div>
    </div>
  );
}
