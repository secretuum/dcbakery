"use client";

import { LocaleLink as Link } from "@/src/i18n/LocaleLink";
import { FallbackImage } from "@/src/components/ui/FallbackImage";
import { EditableText } from "@/src/components/home/SiteEditMode";
import { formatPrice } from "@/src/lib/format";
import { useLocale, useT } from "@/src/i18n/client";
import { localizeProduct } from "@/src/i18n/product";
import type { Product } from "@/src/types";

type Props = {
  products: Product[];
};

export function HomePopularPosters({ products }: Props) {
  const t = useT();
  const locale = useLocale();

  if (!products || products.length === 0) {
    return null;
  }

  const items = products.slice(0, 6);

  return (
    <section id="popular" className="py-10">
      <div className="mx-auto w-full max-w-7xl px-5 md:px-8 lg:px-10">
        {/* section head */}
        <div className="mb-6 flex flex-col gap-3 md:mb-8 md:flex-row md:items-end md:justify-between md:gap-6">
          <div className="min-w-0">
            <span className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.14em] text-coral">
              <EditableText field="home.posters.eyebrow" fallback={t("Популярное")} />
            </span>
            <h2 className="font-display text-[clamp(24px,3vw,34px)] font-bold leading-[1.15] tracking-[-0.02em] text-dark">
              <EditableText field="home.posters.title" fallback={t("Часто берут партнёры")} />
            </h2>
          </div>
          <div className="flex-shrink-0">
            <Link
              href="/catalog"
              className="inline-flex items-center justify-center rounded-full border border-black/10 bg-white px-4 py-2 text-[13.5px] font-semibold text-dark transition-colors hover:bg-cream-deep"
            >
              <EditableText field="home.posters.viewAll" fallback={t("Смотреть все")} />
            </Link>
          </div>
        </div>

        {/* rail -> grid */}
        <div className="no-scrollbar -mx-5 grid snap-x snap-mandatory grid-flow-col auto-cols-[74%] gap-3 overflow-x-auto px-5 pb-2 [overscroll-behavior-x:contain] sm:auto-cols-[44%] md:-mx-8 md:px-8 lg:mx-0 lg:grid-flow-row lg:grid-cols-4 lg:gap-5 lg:overflow-visible lg:px-0">
          {items.map((product) => {
            const image = product.images?.[0];
            // Название берём из перевода каталога (name_kk/name_en), иначе русское.
            const localizedName = localizeProduct(product, locale).name;
            return (
              <Link
                key={product.id}
                href="/catalog"
                className="group relative block aspect-[4/5] min-w-0 snap-start overflow-hidden rounded-2xl bg-cream-deep shadow-sm transition-[box-shadow,translate] duration-300 ease-out hover:-translate-y-[3px] hover:shadow-lg"
              >
                {/* image */}
                <div className="absolute inset-0 transition-transform duration-500 ease-out group-hover:scale-105">
                  <FallbackImage
                    src={image}
                    alt={localizedName}
                    fill
                    sizes="(min-width: 1100px) 25vw, (min-width: 640px) 44vw, 74vw"
                    className="object-cover"
                    categoryId={product.category_id}
                    categorySlug={product.category?.slug}
                  />
                </div>

                {/* scrim */}
                <div
                  className="pointer-events-none absolute inset-x-0 bottom-0 top-[40%]"
                  style={{
                    background:
                      "linear-gradient(to top, rgba(28, 20, 16, 0.78) 0%, rgba(28, 20, 16, 0.28) 46%, transparent 100%)",
                  }}
                />

                {/* body */}
                <div className="absolute inset-x-0 bottom-0 flex items-end gap-3 p-5">
                  <div className="min-w-0">
                    <div className="overflow-hidden font-display text-[17px] font-bold leading-[1.22] tracking-[-0.02em] text-white [overflow-wrap:anywhere] [-webkit-box-orient:vertical] [-webkit-line-clamp:2] [display:-webkit-box]">
                      {localizedName}
                    </div>
                    <div className="mt-[5px] text-[13.5px] font-semibold tabular-nums text-white/[.86]">
                      {product.price > 0 ? formatPrice(product.price) : t("Цена уточняется")}
                    </div>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
}
