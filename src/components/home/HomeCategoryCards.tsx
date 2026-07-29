"use client";

import Link from "next/link";
import { FallbackImage } from "@/src/components/ui/FallbackImage";
import { useT } from "@/src/i18n/client";

type Category = { id: string; slug: string; name: string };

type HomeCategoryCardsProps = {
  categories: Category[];
  counts?: Record<string, number>;
};

function plural(n: number, forms: [string, string, string]): string {
  const abs = Math.abs(n) % 100;
  const n1 = abs % 10;
  if (abs > 10 && abs < 20) return forms[2];
  if (n1 > 1 && n1 < 5) return forms[1];
  if (n1 === 1) return forms[0];
  return forms[2];
}

export function HomeCategoryCards({ categories, counts }: HomeCategoryCardsProps) {
  const t = useT();

  if (!categories || categories.length === 0) return null;

  return (
    <section className="py-10">
      <div className="mx-auto w-full max-w-7xl px-5 lg:px-8">
        <div className="mb-6 flex flex-col gap-3 md:mb-8 md:flex-row md:items-end md:justify-between md:gap-6">
          <div className="min-w-0">
            <span className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.14em] text-coral">
              {t("Каталог")}
            </span>
            <h2 className="font-display text-[clamp(24px,3vw,34px)] font-bold leading-[1.1] tracking-[-0.01em] text-dark">
              {t("Закупка по разделам")}
            </h2>
          </div>
          <div className="shrink-0">
            <Link
              href="/catalog"
              className="inline-flex items-center gap-1.5 rounded-full px-3.5 py-2 text-xs font-semibold text-dark transition-colors hover:text-coral"
            >
              {t("Весь каталог")}
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M9 6l6 6-6 6" />
              </svg>
            </Link>
          </div>
        </div>

        {/* responsive auto-fill grid ~230px */}
        <div className="grid grid-cols-[repeat(auto-fill,minmax(230px,1fr))] gap-4 md:gap-5">
          {categories.map((category) => {
            const rawCount = counts?.[category.slug] ?? counts?.[category.id];
            const hasCount = typeof rawCount === "number";

            return (
              <Link
                key={category.id}
                href={`/catalog?category=${category.slug}`}
                className="group relative flex min-h-[178px] flex-col gap-4 overflow-hidden rounded-xl bg-white p-5 shadow-sm transition-[box-shadow,translate] duration-200 ease-out hover:-translate-y-[3px] hover:shadow-lg"
              >
                {/* decorative circle */}
                <span aria-hidden="true" className="pointer-events-none absolute -bottom-7 -right-7 z-0 h-32 w-32 rounded-full bg-cream-deep" />

                {/* icon tile */}
                <span className="relative z-[1] grid h-[52px] w-[52px] place-items-center overflow-hidden rounded-md bg-accent-50 p-2.5">
                  <span className="relative block h-full w-full">
                    <FallbackImage
                      src={undefined}
                      alt=""
                      fill
                      sizes="52px"
                      className="object-contain"
                      categoryId={category.id}
                      categorySlug={category.slug}
                    />
                  </span>
                </span>

                <span className="relative z-[1] block">
                  <span className="block font-display text-[17px] font-bold leading-tight tracking-[-0.02em] text-dark">
                    {category.name}
                  </span>
                </span>

                {hasCount ? (
                  <span className="relative z-[1] mt-auto inline-flex items-center gap-1.5 text-xs font-semibold text-coral">
                    {rawCount}{" "}
                    {t(plural(rawCount as number, ["позиция", "позиции", "позиций"]))}
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M5 12h14M13 6l6 6-6 6" />
                    </svg>
                  </span>
                ) : (
                  <span className="relative z-[1] mt-auto inline-flex items-center gap-1.5 text-xs font-semibold text-coral">
                    {t("В каталог")}
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M5 12h14M13 6l6 6-6 6" />
                    </svg>
                  </span>
                )}
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
}
