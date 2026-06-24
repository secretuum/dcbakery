"use client";

import Link from "next/link";
import { FallbackImage } from "@/src/components/ui/FallbackImage";
import { QuantitySelector } from "@/src/components/product/QuantitySelector";
import { useCart } from "@/src/contexts/CartContext";
import { formatPrice, formatProductPrice } from "@/src/lib/format";
import type { CartItem as CartItemType } from "@/src/types";

type CartItemProps = {
  item: CartItemType;
};

export function CartItem({ item }: CartItemProps) {
  const { remove, updateQty } = useCart();
  const { product, qty } = item;
  const imageSrc = product.images[0] ?? "/product-placeholder.png";
  const lineTotal = product.price * qty;

  return (
    <article className="grid gap-4 rounded-card bg-white p-4 shadow-[0_14px_40px_rgba(120,51,38,0.08)] sm:grid-cols-[112px_1fr] sm:p-5">
      <Link
        href={`/product/${product.slug}`}
        className="relative aspect-square overflow-hidden rounded-card bg-coral-light"
      >
        <FallbackImage
          src={imageSrc}
          alt={product.name}
          fill
          sizes="112px"
          className="object-cover"
        />
      </Link>

      <div className="min-w-0">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-xs font-black uppercase text-raspberry">
              {product.category?.name ?? "Каталог"}
            </p>
            <Link href={`/product/${product.slug}`} className="mt-1 block">
              <h2 className="text-2xl font-black leading-8 tracking-tight text-dark">
                {product.name}
              </h2>
            </Link>
            <p className="mt-2 text-sm font-semibold text-muted">
              Фасовка: {product.weightLabel ?? "уточняется"}
            </p>
          </div>

          <button
            type="button"
            onClick={() => remove(product.id)}
            className="self-start rounded-btn px-3 py-2 text-sm font-black text-muted transition hover:bg-coral-light hover:text-dark"
          >
            Удалить
          </button>
        </div>

        <div className="mt-5 grid gap-4 md:grid-cols-[minmax(180px,240px)_1fr] md:items-end">
          <QuantitySelector
            maxQty={product.stock_qty}
            minQty={product.min_qty}
            onChange={(nextQty) => updateQty(product.id, nextQty)}
            stepQty={product.step_qty}
            unit={product.unit}
            value={qty}
          />

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-btn bg-cream px-4 py-3">
              <p className="text-xs font-black uppercase text-muted">Цена за ед.</p>
              <p className="mt-1 text-lg font-black text-dark">{formatProductPrice(product.price)}</p>
            </div>
            <div className="rounded-btn bg-coral-light px-4 py-3">
              <p className="text-xs font-black uppercase text-muted">Сумма</p>
              <p className="mt-1 text-lg font-black text-dark">
                {product.price > 0 ? formatPrice(lineTotal) : "Цена уточняется"}
              </p>
            </div>
          </div>
        </div>
      </div>
    </article>
  );
}
