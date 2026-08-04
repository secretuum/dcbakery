"use client";

import { useEffect } from "react";
import { createPortal } from "react-dom";
import { FallbackImage } from "@/src/components/ui/FallbackImage";
import { ProductComments } from "@/src/components/catalog/ProductComments";
import { lockBodyScroll, unlockBodyScroll } from "@/src/lib/scroll-lock";
import { useCart } from "@/src/contexts/CartContext";
import { useToast } from "@/src/contexts/ToastContext";
import { formatPrice, formatProductPrice } from "@/src/lib/format";
import { useLocale, useT } from "@/src/i18n/client";
import { localizeMeasure, localizeProduct } from "@/src/i18n/product";
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

  // Блокировка прокрутки — через общий реф-счётчик (mount-only, сбалансировано),
  // чтобы не конфликтовать с корзиной, которая тоже блокирует скролл body.
  useEffect(() => {
    lockBodyScroll();
    return () => unlockBodyScroll();
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
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
      ["Фасовка", localizeMeasure(product.weightLabel, locale)],
      ["Минимальный заказ", product.min_qty > 1 ? `${product.min_qty} ${t(product.unit)}` : null],
      ["В наличии", product.stock_qty > 0 ? `${product.stock_qty} ${t(product.unit)}` : null],
      ["Срок годности", localizeMeasure(product.shelfLife, locale)],
      ["Хранение", localizeMeasure(product.storage, locale)],
      ["Упаковка", product.packageType ? t(product.packageType) : null],
    ] as Array<[string, string | null | undefined]>
  ).filter((row): row is [string, string] => Boolean(row[1]) && row[1] !== "уточняется");

  // Nutri-плитки поверх фото: показываем только те, у которых есть данные.
  const nutriTiles: Array<{ value: string; label: string }> = (
    [
      product.weightGrams ? { value: `${product.weightGrams} ${t("г")}`, label: t("фасовка") } : null,
      localizeMeasure(product.shelfLife, locale) && localizeMeasure(product.shelfLife, locale) !== "уточняется"
        ? { value: localizeMeasure(product.shelfLife, locale), label: t("срок годности") }
        : null,
      product.packageType ? { value: t(product.packageType), label: t("упаковка") } : null,
    ] as Array<{ value: string; label: string } | null>
  ).filter((tile): tile is { value: string; label: string } => Boolean(tile));

  // Чипсы: фасовка / упаковка / Халал / остаток.
  const weightChip = product.weightLabel ? localizeMeasure(product.weightLabel, locale) : "";

  // Портал: у карточек бывает transform (анимация появления), который делает их
  // containing block для fixed — без портала шторка прибивается к карточке.
  return createPortal(
    <div
      className="fixed inset-0 z-[60] flex items-end justify-center lg:items-center lg:p-6"
      role="dialog"
      aria-modal="true"
      aria-label={localized.name}
    >
      {/* Backdrop */}
      <div className="animate-fade-in-bg absolute inset-0 bg-black/45" onClick={onClose} />

      {/* Panel */}
      <div className="animate-slide-up-panel relative flex w-full h-[100dvh] flex-col overflow-hidden bg-cream shadow-xl lg:h-auto lg:max-h-[min(88vh,780px)] lg:max-w-[1040px] lg:flex-row lg:rounded-2xl">
        {/* Media column */}
        <div
          className="relative h-[52dvh] w-full shrink-0 overflow-hidden lg:h-auto lg:w-[46%]"
          style={{
            background: "linear-gradient(165deg, var(--color-cream-deep), var(--color-cream-warm))",
          }}
        >
          <FallbackImage
            src={imageSrc}
            alt={localized.name}
            fill
            sizes="(max-width: 900px) 100vw, 480px"
            className="object-cover"
            categoryId={product.category_id}
            categorySlug={product.category?.slug}
          />

          {/* Topbar over photo */}
          <div className="absolute inset-x-0 top-0 z-10 flex items-center justify-between p-4">
            <button
              type="button"
              onClick={onClose}
              className="flex h-11 w-11 items-center justify-center rounded-full border border-black/10 bg-white/70 text-dark shadow-sm backdrop-blur transition hover:bg-white"
              aria-label={t("Закрыть")}
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
            <span
              className="flex h-11 w-11 items-center justify-center rounded-full border border-black/10 bg-white/70 text-muted shadow-sm backdrop-blur"
              aria-hidden="true"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M11.48 3.5a.56.56 0 011.04 0l2.12 4.29 4.74.69a.56.56 0 01.31.96l-3.43 3.34.81 4.72a.56.56 0 01-.82.59L12 16.35l-4.24 2.23a.56.56 0 01-.82-.59l.81-4.72-3.43-3.34a.56.56 0 01.31-.96l4.74-.69z"
                />
              </svg>
            </span>
          </div>

          {/* Nutri tiles */}
          {nutriTiles.length > 0 ? (
            <div className="absolute inset-x-0 bottom-0 z-10 grid grid-cols-3 gap-2 p-4">
              {nutriTiles.map((tile) => (
                <div
                  key={tile.label}
                  className="rounded-md bg-white/[.78] px-2 py-2 text-center shadow-xs backdrop-blur"
                >
                  <div className="font-display text-[15px] font-bold leading-tight text-dark">{tile.value}</div>
                  <div className="mt-0.5 text-[11px] font-medium text-muted">{tile.label}</div>
                </div>
              ))}
            </div>
          ) : null}
        </div>

        {/* Info + buy column */}
        <div className="flex min-h-0 flex-1 flex-col lg:w-[54%]">
          {/* Scrollable info */}
          <div className="no-scrollbar relative -mt-7 min-h-0 flex-1 overflow-y-auto rounded-t-3xl bg-white px-5 pb-6 pt-6 lg:mt-0 lg:rounded-none lg:px-8 lg:pt-8">
            <h2
              className="font-display font-bold leading-snug text-dark"
              style={{ fontSize: "clamp(22px,3vw,30px)" }}
            >
              {localized.name}
            </h2>

            {/* Chips */}
            <div className="mt-3 flex flex-wrap gap-2">
              {weightChip ? (
                <span className="rounded-full bg-cream-deep px-3 py-1 text-[13.5px] font-semibold text-dark">
                  {weightChip}
                </span>
              ) : null}
              {product.packageType ? (
                <span className="rounded-full bg-cream-deep px-3 py-1 text-[13.5px] font-semibold text-dark">
                  {t(product.packageType)}
                </span>
              ) : null}
              {product.isHalal ? (
                <span className="rounded-full bg-accent-50 px-3 py-1 text-[13.5px] font-semibold text-accent-700">
                  {t("Халал")}
                </span>
              ) : null}
              <span
                className={`rounded-full px-3 py-1 text-[13.5px] font-semibold ${
                  isInStock ? "bg-success-bg text-success" : "bg-cream-deep text-muted"
                }`}
              >
                {isInStock
                  ? product.stock_qty > 0
                    ? `${t("В наличии")}: ${product.stock_qty} ${t(product.unit)}`
                    : t("В наличии")
                  : t("нет в наличии")}
              </span>
            </div>

            {/* Price */}
            <div className="mt-4 flex items-baseline gap-3">
              <span
                className="font-display font-extrabold tabular-nums text-dark"
                style={{ fontSize: "clamp(26px,3.4vw,34px)" }}
              >
                {formatProductPrice(product.price)}
              </span>
              {weightChip ? (
                <span className="text-[13.5px] font-medium text-muted">
                  {t("за")} {weightChip}
                </span>
              ) : null}
            </div>

            {/* Description */}
            {localized.description ? (
              <p className="mt-4 text-[15px] leading-relaxed text-muted">{localized.description}</p>
            ) : null}

            {/* Expandable: Состав */}
            {localized.composition ? (
              <details className="mt-5 border-t border-black/10 pt-3">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-[15px] font-semibold text-dark">
                  <span>{t("Состав")}</span>
                  <svg className="h-4 w-4 text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 9l6 6 6-6" />
                  </svg>
                </summary>
                <p className="mt-2 text-[15px] leading-relaxed text-muted">{localized.composition}</p>
                {product.compositionKz ? (
                  <p className="mt-1.5 text-[13.5px] leading-relaxed text-muted-light">
                    {t("Құрамы")}: {product.compositionKz}
                  </p>
                ) : null}
              </details>
            ) : null}

            {/* Expandable: Характеристики */}
            {details.length > 0 ? (
              <details className="mt-4 border-t border-black/10 pt-3">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-[15px] font-semibold text-dark">
                  <span>{t("Характеристики")}</span>
                  <svg className="h-4 w-4 text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 9l6 6 6-6" />
                  </svg>
                </summary>
                <div className="mt-3">
                  {details.map(([label, value], i) => (
                    <div
                      key={label}
                      className={`flex items-baseline justify-between gap-4 py-2 ${
                        i < details.length - 1 ? "border-b border-black/[.06]" : ""
                      }`}
                    >
                      <span className="text-[13.5px] text-muted">{t(label)}</span>
                      <span className="text-right text-[15px] font-semibold text-dark">{value}</span>
                    </div>
                  ))}
                </div>
              </details>
            ) : null}

            <ProductComments slug={product.slug} />
          </div>

          {/* Buy bar */}
          <div
            className="sticky bottom-0 shrink-0 border-t border-black/10 bg-white/85 px-5 pt-3 backdrop-blur lg:px-8"
            style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 0.75rem)" }}
          >
            {cartQty > 0 ? (
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-2 rounded-full border border-black/10 p-1">
                  <button
                    type="button"
                    onClick={handleDecrease}
                    className="flex h-11 w-11 items-center justify-center rounded-full text-xl font-bold text-dark transition hover:bg-black/5"
                    aria-label={t("Уменьшить количество")}
                  >
                    −
                  </button>
                  <span className="w-10 text-center text-lg font-bold tabular-nums text-dark">{cartQty}</span>
                  <button
                    type="button"
                    onClick={handleIncrease}
                    disabled={cartQty >= product.stock_qty}
                    className="flex h-11 w-11 items-center justify-center rounded-full bg-coral text-xl font-bold text-white transition hover:bg-coral-hover disabled:bg-black/10 disabled:text-muted"
                    aria-label={t("Увеличить количество")}
                  >
                    +
                  </button>
                </div>
                <div className="text-right">
                  <p className="text-[11px] font-semibold uppercase tracking-[.08em] text-muted">
                    {t("В корзине")}
                  </p>
                  <p className="font-display text-xl font-bold leading-tight tabular-nums text-dark">
                    {formatPrice(product.price * cartQty)}
                  </p>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={handleAdd}
                disabled={!isInStock}
                className="block w-full rounded-full bg-coral py-3.5 text-center text-[15px] font-semibold text-white shadow-accent transition hover:bg-coral-hover active:scale-[.99] disabled:cursor-not-allowed disabled:bg-black/10 disabled:text-muted disabled:shadow-none"
              >
                {isInStock ? `${t("В корзину")} · ${formatProductPrice(product.price)}` : t("Нет в наличии")}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
