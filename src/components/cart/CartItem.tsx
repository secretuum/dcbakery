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
    <article className="grid grid-cols-[80px_1fr] gap-4 rounded-card border border-black/10 bg-white p-4 sm:grid-cols-[112px_1fr] sm:p-5">
      <Link
        href={`/product/${product.slug}`}
        className="relative aspect-square self-start overflow-hidden rounded border border-black/10 bg-cream"
      >
        <FallbackImage
          src={imageSrc}
          alt={localizedName}
          fill
          sizes="112px"
          className="object-cover"
        />
      </Link>

      <div className="min-w-0">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[.1em] text-muted">
              {product.category?.name ?? "Каталог"}
            </p>
            <Link href={`/product/${product.slug}`} className="mt-1 block">
              <h2 className="text-base font-semibold leading-6 text-dark">
                {localizedName}
              </h2>
            </Link>
            <p className="mt-2 text-sm text-muted">
              Фасовка: {product.weightLabel ?? "уточняется"}
            </p>
          </div>

          <button
            type="button"
            onClick={() => remove(product.id)}
            className="self-start rounded-btn px-3 py-2 text-sm font-semibold text-muted transition hover:bg-coral-light hover:text-dark"
          >{t("Удалить")}</button>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-[minmax(180px,240px)_1fr] md:items-center">
          <QuantitySelector
            maxQty={product.stock_qty}
            minQty={product.min_qty}
            onChange={(nextQty) => updateQty(product.id, nextQty)}
            stepQty={product.step_qty}
            unit={product.unit}
            value={qty}
          />

          <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 md:justify-end">
            <p className="font-data text-sm text-muted">
              {formatProductPrice(product.price)} / ед.
            </p>
            <p className="font-data text-lg font-semibold text-dark">
              {product.price > 0 ? formatPrice(lineTotal) : "Цена уточняется"}
            </p>
          </div>
        </div>
      </div>
    </article>
  );
}
