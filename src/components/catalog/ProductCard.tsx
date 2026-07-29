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
  const [justAdded, setJustAdded] = useState(false);
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
    setJustAdded(true);
    window.setTimeout(() => setJustAdded(false), 1400);
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
  const hasImage = product.images.length > 0;

  return (
    <article
      className={`product-card flex flex-col overflow-hidden rounded-xl bg-white shadow-xs transition-[box-shadow,translate] duration-300 ease-out hover:-translate-y-[3px] hover:shadow-lg ${
        justAdded ? "ring-2 ring-coral" : ""
      } ${!isInStock ? "is-out" : ""}`}
    >
      {/* media */}
      <button
        type="button"
        onClick={() => setIsSheetOpen(true)}
        className="relative block aspect-square w-full cursor-pointer overflow-hidden bg-cream text-left"
        aria-label={`${t("Подробнее:")} ${localized.name}`}
      >
        <FallbackImage
          src={imageSrc}
          alt={localized.name}
          categoryId={product.category_id}
          categorySlug={product.category?.slug}
          fill
          sizes="(max-width: 640px) 50vw, (max-width: 1280px) 25vw, 20vw"
          className={`object-cover transition-transform duration-500 ease-out hover:scale-[1.045] ${
            !isInStock ? "opacity-50 grayscale" : ""
          }`}
        />

        {/* flags — top-left stacked column */}
        <span className="pointer-events-none absolute left-2.5 top-2.5 flex flex-col items-start gap-[5px]">
          {product.isNew ? <Badge variant="coral">{t("Новинка")}</Badge> : null}
          {product.isPopular ? <Badge variant="burgundy">{t("Хит")}</Badge> : null}
          {!hasImage ? <Badge variant="neutral">{t("Без фото")}</Badge> : null}
          {!isInStock ? (
            <Badge variant="neutral">{t("Нет в наличии")}</Badge>
          ) : lowStock ? (
            <Badge variant="amber">{t("Мало")}</Badge>
          ) : null}
        </span>
      </button>

      {/* body */}
      <div className="flex flex-1 flex-col gap-2 p-4">
        <h3
          className="line-clamp-2 min-h-[2.64em] cursor-pointer text-[15px] font-semibold leading-[1.32] tracking-[-0.012em] text-dark"
          onClick={() => setIsSheetOpen(true)}
        >
          {localized.name}
        </h3>

        {/* meta: weight · stock */}
        <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted">
          {product.weightLabel ? (
            <>
              <span>{product.weightLabel}</span>
              <span aria-hidden="true">·</span>
            </>
          ) : null}
          <span
            className={`inline-flex items-center gap-[5px] font-semibold ${
              isInStock ? (lowStock ? "text-warning" : "text-success") : "text-muted"
            }`}
          >
            <span className="size-1.5 rounded-full bg-current" aria-hidden="true" />
            {isInStock
              ? lowStock
                ? `${t("Осталось")} ${product.stock_qty} ${t(product.unit)}`
                : t("В наличии")
              : t("Нет в наличии")}
          </span>
        </div>

        {/* foot: price + control */}
        <div className="mt-auto flex items-center gap-3 pt-3">
          <div className="min-w-0">
            <p
              className={`whitespace-nowrap font-display text-[17px] font-bold tabular-nums tracking-[-0.02em] ${
                isInStock ? "text-dark" : "text-muted"
              }`}
            >
              {priceText}
            </p>
            <small className="block font-sans text-[11px] text-muted">{t("за упаковку")}</small>
          </div>

          {!isInStock ? (
            <button
              type="button"
              disabled
              className="ml-auto shrink-0 rounded-full border border-black/10 bg-white px-3 py-1.5 text-[13.5px] font-semibold text-muted"
            >
              {t("Нет")}
            </button>
          ) : inCart ? (
            <div className="ml-auto flex shrink-0 items-center gap-1 rounded-full border border-black/10 p-0.5">
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
              className={`ml-auto flex size-9 shrink-0 items-center justify-center rounded-full text-xl font-bold transition ${
                justAdded
                  ? "bg-success text-white"
                  : "bg-coral text-white hover:bg-coral-hover disabled:bg-black/10 disabled:text-muted"
              }`}
              aria-label={`${t("Добавить в корзину:")} ${localized.name}`}
            >
              {justAdded ? "✓" : "+"}
            </button>
          )}
        </div>
      </div>

      {isSheetOpen && <ProductSheet product={product} onClose={() => setIsSheetOpen(false)} />}
    </article>
  );
}
