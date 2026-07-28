"use client";

import { useState } from "react";
import { Badge } from "@/src/components/ui/Badge";
import { FallbackImage } from "@/src/components/ui/FallbackImage";
import { ProductSheet } from "@/src/components/catalog/ProductSheet";
import { useCart } from "@/src/contexts/CartContext";
import { useToast } from "@/src/contexts/ToastContext";
import { formatProductPrice } from "@/src/lib/format";
import { useLocale, useT } from "@/src/i18n/client";
import { localizeProduct } from "@/src/i18n/product";
import type { Product } from "@/src/types";

type ProductCardProps = {
  product: Product;
};

export function ProductCard({ product }: ProductCardProps) {
  const t = useT();
  const locale = useLocale();
  const localized = localizeProduct(product, locale);
  const { add, remove, updateQty, isReady, items } = useCart();
  const { showToast } = useToast();
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const imageSrc = product.images[0] ?? "/product-placeholder.png";
  const isInStock = isReady && product.stock_qty > 0;
  const priceText = formatProductPrice(product.price);
  const cartItem = items.find((item) => item.product.id === product.id);
  const cartQty = cartItem?.qty ?? 0;
  const inCart = cartQty > 0;
  const step = product.step_qty;

  function handleAddToCart() {
    if (cartQty >= product.stock_qty) {
      showToast(t("В корзине уже весь доступный остаток"), "info");
      return;
    }
    add(product, Math.max(1, product.min_qty ?? product.step_qty ?? 1));
    showToast(t("Товар добавлен в корзину"), "success");
  }

  function handleIncrease() {
    if (cartQty >= product.stock_qty) {
      showToast(t("В корзине уже весь доступный остаток"), "info");
      return;
    }
    updateQty(product.id, cartQty + step);
  }

  function handleDecrease() {
    const next = cartQty - step;
    if (next <= 0) {
      remove(product.id);
    } else {
      updateQty(product.id, next);
    }
  }

  const lowStock = isInStock && product.stock_qty <= 5;

  return (
    <article className="product-card flex flex-col overflow-hidden rounded-xl bg-white shadow-xs transition duration-300 hover:-translate-y-0.5 hover:shadow-lg">
      <button
        type="button"
        onClick={() => setIsSheetOpen(true)}
        className="relative block w-full cursor-pointer overflow-hidden text-left"
        aria-label={`${t("Подробнее:")} ${localized.name}`}
      >
        <div className="relative aspect-square overflow-hidden bg-cream">
          <FallbackImage
            src={imageSrc}
            alt={localized.name}
            categoryId={product.category_id}
            categorySlug={product.category?.slug}
            fill
            sizes="(max-width: 640px) 50vw, (max-width: 1280px) 25vw, 20vw"
            className={`object-cover transition-transform duration-500 hover:scale-[1.045] ${!isInStock ? "opacity-50 grayscale" : ""}`}
          />
          {!isInStock && (
            <span className="absolute left-2.5 top-2.5">
              <Badge variant="dark">{t("Нет в наличии")}</Badge>
            </span>
          )}
        </div>
      </button>

      <div className="flex flex-1 flex-col gap-2 p-4">
        <h3
          className="line-clamp-2 min-h-[2.6em] cursor-pointer text-[15px] font-semibold leading-snug text-dark"
          onClick={() => setIsSheetOpen(true)}
        >
          {localized.name}
        </h3>

        <p className="text-xs font-semibold">
          {isInStock ? (
            <span className={lowStock ? "text-warning" : "text-success"}>
              {lowStock ? `${t("Осталось")} ${product.stock_qty} ${t(product.unit)}` : t("В наличии")}
            </span>
          ) : (
            <span className="text-muted">{t("Нет в наличии")}</span>
          )}
          {product.min_qty > 1 ? (
            <span className="text-muted"> · {t("Мин.")} {product.min_qty} {t(product.unit)}</span>
          ) : null}
        </p>

        <div className="mt-auto flex items-center justify-between gap-2 pt-1">
          <p className="font-display text-[17px] font-bold tabular-nums text-dark">{priceText}</p>

          {inCart ? (
            <div className="flex items-center gap-1 rounded-full border border-black/10 p-0.5">
              <button
                onClick={handleDecrease}
                className="flex size-8 items-center justify-center rounded-full text-lg font-bold text-dark transition hover:bg-black/5"
                aria-label={t("Уменьшить количество")}
              >
                −
              </button>
              <span className="min-w-6 text-center text-sm font-bold tabular-nums text-dark">{cartQty}</span>
              <button
                onClick={handleIncrease}
                disabled={cartQty >= product.stock_qty}
                className="flex size-8 items-center justify-center rounded-full bg-coral text-white transition hover:bg-coral-hover disabled:bg-black/10 disabled:text-muted"
                aria-label={t("Увеличить количество")}
              >
                +
              </button>
            </div>
          ) : (
            <button
              onClick={handleAddToCart}
              disabled={!isInStock}
              className="flex size-9 items-center justify-center rounded-full bg-coral text-xl font-bold text-white transition hover:bg-coral-hover disabled:bg-black/10 disabled:text-muted"
              aria-label={`${t("Добавить в корзину:")} ${localized.name}`}
            >
              +
            </button>
          )}
        </div>
      </div>

      {isSheetOpen && <ProductSheet product={product} onClose={() => setIsSheetOpen(false)} />}
    </article>
  );
}
