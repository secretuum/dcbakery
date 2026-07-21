"use client";

import { useEffect } from "react";
import { createPortal } from "react-dom";
import { FallbackImage } from "@/src/components/ui/FallbackImage";
import { useCart } from "@/src/contexts/CartContext";
import { useToast } from "@/src/contexts/ToastContext";
import { formatPrice, formatProductPrice } from "@/src/lib/format";
import { useLocale, useT } from "@/src/i18n/client";
import { localizeProduct } from "@/src/i18n/product";
import type { Product } from "@/src/types";

type ProductSheetProps = {
  product: Product;
  onClose: () => void;
};

export function ProductSheet({ product, onClose }: ProductSheetProps) {
  const t = useT();
  const locale = useLocale();
  const localized = localizeProduct(product, locale);
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

  // Портал: у карточек бывает transform (анимация появления), который делает их
  // containing block для fixed — без портала шторка прибивается к карточке.
  return createPortal(
    <div className="fixed inset-0 z-[60] flex items-end justify-center" role="dialog" aria-modal="true" aria-label={localized.name}>
      {/* Backdrop */}
      <div className="animate-fade-in-bg absolute inset-0 bg-black/40" onClick={onClose} />

      {/* Panel */}
      <div
        className="animate-slide-up-panel relative flex w-full max-w-lg flex-col overflow-hidden border-t border-black/10 bg-white shadow-[0_-8px_40px_rgba(0,0,0,0.15)]"
        style={{ maxHeight: "92vh", paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
      >
        {/* Scrollable content */}
        <div className="no-scrollbar min-h-0 flex-1 overflow-y-auto">
          <div className="relative aspect-square w-full bg-cream">
            <FallbackImage
              src={imageSrc}
              alt={localized.name}
              fill
              sizes="(max-width: 640px) 100vw, 512px"
              className="object-cover"
            />
            <button
              type="button"
              onClick={onClose}
              className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center border border-black/10 bg-white text-dark transition hover:bg-black/5"
              aria-label={t("Закрыть")}
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
            {!isInStock && (
              <span className="absolute left-3 top-3 border border-black/20 bg-white px-3 py-1 text-xs font-bold text-dark">{t("нет в наличии")}</span>
            )}
          </div>

          <div className="px-4 pb-4 pt-4">
            <p className="text-xs font-semibold uppercase tracking-[.1em] text-muted">
              {product.weightLabel ?? product.unit}
            </p>
            <h2 className="mt-1.5 font-display text-xl font-bold leading-snug text-dark">
              {localized.name}
            </h2>
            <p className="mt-2 font-data text-xl font-semibold text-coral">
              {formatProductPrice(product.price)}
            </p>

            {localized.description ? (
              <p className="mt-3 text-sm leading-6 text-muted">{localized.description}</p>
            ) : null}

            {details.length > 0 ? (
              <div className="mt-4 border border-black/8 bg-cream">
                {details.map(([label, value], i) => (
                  <div key={label}
                    className={`flex items-baseline justify-between gap-4 px-4 py-2.5 ${i < details.length - 1 ? "border-b border-black/5" : ""}`}>
                    <span className="text-xs font-semibold text-muted">{t(label)}</span>
                    <span className="text-right text-sm font-semibold text-dark">{value}</span>
                  </div>
                ))}
              </div>
            ) : null}

            {localized.composition ? (
              <details className="mt-3 border border-black/8 bg-cream px-4 py-3">
                <summary className="cursor-pointer text-sm font-semibold text-dark">{t("Состав")}</summary>
                <p className="mt-2 text-sm leading-6 text-muted">{localized.composition}</p>
              </details>
            ) : null}
          </div>
        </div>

        {/* Footer CTA */}
        <div className="shrink-0 border-t border-black/10 px-4 pb-4 pt-3">
          {cartQty > 0 ? (
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleDecrease}
                  className="flex h-11 w-11 items-center justify-center border border-black/10 text-xl font-bold text-dark transition hover:bg-black/5"
                  aria-label={t("Уменьшить количество")}
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
                  className="flex h-11 w-11 items-center justify-center border border-coral bg-coral text-xl font-bold text-white transition hover:bg-coral-hover disabled:border-black/10 disabled:bg-black/5 disabled:text-muted"
                  aria-label={t("Увеличить количество")}
                >
                  +
                </button>
              </div>
              <div className="text-right">
                <p className="text-[10px] font-semibold uppercase tracking-[.08em] text-muted">{t("В корзине")}</p>
                <p className="font-data text-xl font-semibold leading-tight text-dark">
                  {formatPrice(product.price * cartQty)}
                </p>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={handleAdd}
              disabled={!isInStock}
              className="block w-full border border-coral bg-coral py-3.5 text-center text-sm font-bold uppercase tracking-[.08em] text-white transition hover:bg-coral-hover disabled:cursor-not-allowed disabled:border-black/10 disabled:bg-black/5 disabled:text-muted"
            >
              {isInStock ? `${t("В корзину")} · ${formatProductPrice(product.price)}` : t("Нет в наличии")}
            </button>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
