"use client";

import { useEffect } from "react";
import { FallbackImage } from "@/src/components/ui/FallbackImage";
import { useCart } from "@/src/contexts/CartContext";
import { useToast } from "@/src/contexts/ToastContext";
import { formatPrice, formatProductPrice } from "@/src/lib/format";
import type { Product } from "@/src/types";

type ProductSheetProps = {
  product: Product;
  onClose: () => void;
};

export function ProductSheet({ product, onClose }: ProductSheetProps) {
  const { add, remove, updateQty, isReady, items } = useCart();
  const { showToast } = useToast();
  const imageSrc = product.images[0] ?? "/product-placeholder.png";
  const isInStock = isReady && product.stock_qty > 0;
  const cartItem = items.find((item) => item.product.id === product.id);
  const cartQty = cartItem?.qty ?? 0;
  const step = product.step_qty;

  useEffect(() => {
    document.body.style.overflow = "hidden";
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [onClose]);

  function handleAdd() {
    if (cartQty >= product.stock_qty) {
      showToast("В корзине уже весь доступный остаток", "info");
      return;
    }
    add(product, Math.max(1, product.min_qty ?? product.step_qty ?? 1));
    showToast("Товар добавлен в корзину", "success");
  }

  function handleIncrease() {
    if (cartQty >= product.stock_qty) {
      showToast("В корзине уже весь доступный остаток", "info");
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

  const details: Array<[string, string]> = (
    [
      ["Фасовка", product.weightLabel],
      ["Минимальный заказ", product.min_qty > 1 ? `${product.min_qty} ${product.unit}` : null],
      ["В наличии", product.stock_qty > 0 ? `${product.stock_qty} ${product.unit}` : null],
      ["Срок годности", product.shelfLife],
      ["Хранение", product.storage],
      ["Упаковка", product.packageType],
    ] as Array<[string, string | null | undefined]>
  ).filter((row): row is [string, string] => Boolean(row[1]) && row[1] !== "уточняется");

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center" role="dialog" aria-modal="true" aria-label={product.name}>
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />

      {/* Panel */}
      <div
        className="relative flex w-full max-w-lg flex-col overflow-hidden rounded-t-3xl bg-white shadow-[0_-8px_30px_rgba(0,0,0,0.12)]"
        style={{ maxHeight: "92vh", paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
      >
        {/* Scrollable content */}
        <div className="no-scrollbar min-h-0 flex-1 overflow-y-auto">
          <div className="relative aspect-square w-full bg-coral-light">
            <FallbackImage
              src={imageSrc}
              alt={product.name}
              fill
              sizes="(max-width: 640px) 100vw, 512px"
              className="object-cover"
            />
            <button
              type="button"
              onClick={onClose}
              className="absolute right-3 top-3 flex h-10 w-10 items-center justify-center rounded-full bg-white text-gray-500 shadow-sm transition hover:text-gray-700"
              aria-label="Закрыть"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
            {!isInStock && (
              <span className="absolute left-3 top-3 rounded-badge bg-dark px-3 py-1 text-xs font-bold text-white">
                нет в наличии
              </span>
            )}
          </div>

          <div className="px-4 pb-4 pt-4">
            <p className="text-xs text-gray-400">{product.weightLabel ?? product.unit}</p>
            <h2 className="mt-1 text-xl font-bold leading-snug text-dark">{product.name}</h2>
            <p className="mt-2 text-lg font-bold text-coral">{formatProductPrice(product.price)}</p>

            {product.description ? (
              <p className="mt-3 text-sm leading-6 text-muted">{product.description}</p>
            ) : null}

            {details.length > 0 ? (
              <div className="mt-4 divide-y divide-gray-100 rounded-2xl bg-cream px-4">
                {details.map(([label, value]) => (
                  <div key={label} className="flex items-baseline justify-between gap-4 py-2.5">
                    <span className="text-xs font-semibold text-muted">{label}</span>
                    <span className="text-right text-sm font-semibold text-dark">{value}</span>
                  </div>
                ))}
              </div>
            ) : null}

            {product.composition ? (
              <details className="mt-3 rounded-2xl bg-cream px-4 py-3">
                <summary className="cursor-pointer text-sm font-semibold text-dark">Состав</summary>
                <p className="mt-2 text-sm leading-6 text-muted">{product.composition}</p>
              </details>
            ) : null}
          </div>
        </div>

        {/* Footer CTA */}
        <div className="shrink-0 border-t border-gray-100 px-4 pb-4 pt-3">
          {cartQty > 0 ? (
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleDecrease}
                  className="flex h-12 w-12 items-center justify-center rounded-full bg-gray-100 text-xl font-bold text-gray-600 transition hover:bg-gray-200"
                  aria-label="Уменьшить количество"
                >
                  −
                </button>
                <span className="w-10 text-center text-lg font-bold tabular-nums text-dark">
                  {cartQty}
                </span>
                <button
                  type="button"
                  onClick={handleIncrease}
                  disabled={cartQty >= product.stock_qty}
                  className="flex h-12 w-12 items-center justify-center rounded-full bg-coral text-xl font-bold text-white transition hover:bg-coral-hover disabled:bg-gray-300"
                  aria-label="Увеличить количество"
                >
                  +
                </button>
              </div>
              <div className="text-right">
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">В корзине</p>
                <p className="text-xl font-black leading-tight text-dark">
                  {formatPrice(product.price * cartQty)}
                </p>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={handleAdd}
              disabled={!isInStock}
              className="block w-full rounded-full bg-coral py-3.5 text-center text-base font-semibold text-white transition-colors hover:bg-coral-hover disabled:cursor-not-allowed disabled:bg-gray-200 disabled:text-gray-400"
            >
              {isInStock ? `В корзину · ${formatProductPrice(product.price)}` : "Нет в наличии"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
