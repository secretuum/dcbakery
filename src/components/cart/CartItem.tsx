"use client";

import Link from "next/link";
import { FallbackImage } from "@/src/components/ui/FallbackImage";
import { QuantitySelector } from "@/src/components/product/QuantitySelector";
import { useCart } from "@/src/contexts/CartContext";
import { formatPrice, formatProductPrice } from "@/src/lib/format";
import { useLocale, useT } from "@/src/i18n/client";
import { localizeProduct } from "@/src/i18n/product";
import type { CartItem as CartItemType } from "@/src/types";

type CartItemProps = {
  item: CartItemType;
};

export function CartItem({ item }: CartItemProps) {
  const t = useT();
  const locale = useLocale();
  const { remove, updateQty } = useCart();
  const { product, qty } = item;
  const localizedName = localizeProduct(product, locale).name;
  const imageSrc = product.images[0] ?? "/product-placeholder.png";
  const lineTotal = product.price * qty;

  return (
    <article className="relative grid grid-cols-[72px_minmax(0,1fr)] gap-3 rounded-lg bg-white p-3 shadow-xs sm:grid-cols-[88px_minmax(0,1fr)] sm:gap-4 sm:p-4">
      <Link
        href={`/product/${product.slug}`}
        className="relative aspect-square self-start overflow-hidden rounded-md bg-cream"
      >
        <FallbackImage
          src={imageSrc}
          alt={localizedName}
          fill
          sizes="88px"
          className="object-cover"
        />
      </Link>

      <div className="flex min-w-0 flex-col gap-2">
        {product.category?.name ? (
          <p className="text-[11px] font-semibold uppercase tracking-[.12em] text-muted">
            {product.category.name}
          </p>
        ) : null}

        <Link href={`/product/${product.slug}`} className="block pr-[30px]">
          <h2 className="text-[13.5px] font-semibold leading-[1.35] text-dark">
            {localizedName}
          </h2>
        </Link>

        <p className="text-xs text-muted">
          {t("Фасовка")}: {product.weightLabel ?? t("уточняется")}
        </p>

        <p className="font-data text-xs text-muted">
          {formatProductPrice(product.price)} / {t("ед.")}
        </p>

        <div className="mt-auto flex items-center gap-3 pt-1">
          <QuantitySelector
            maxQty={product.stock_qty}
            minQty={product.min_qty}
            onChange={(nextQty) => updateQty(product.id, nextQty)}
            stepQty={product.step_qty}
            unit={product.unit}
            value={qty}
          />

          <span className="ml-auto whitespace-nowrap font-data text-[15px] font-bold tabular-nums text-dark">
            {product.price > 0 ? formatPrice(lineTotal) : t("Цена уточняется")}
          </span>
        </div>
      </div>

      <button
        type="button"
        onClick={() => remove(product.id)}
        aria-label={t("Удалить")}
        className="absolute right-2.5 top-2.5 inline-flex h-9 w-9 items-center justify-center rounded-full text-muted transition hover:bg-black/[.06] hover:text-coral"
      >
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M18 6 6 18" />
          <path d="m6 6 12 12" />
        </svg>
      </button>
    </article>
  );
}
