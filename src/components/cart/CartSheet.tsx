"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { FallbackImage } from "@/src/components/ui/FallbackImage";
import { lockBodyScroll, unlockBodyScroll } from "@/src/lib/scroll-lock";
import { useCart } from "@/src/contexts/CartContext";
import { formatPrice } from "@/src/lib/format";
import { FREE_DELIVERY_THRESHOLD } from "@/app/constants";
import { useLocale, useT } from "@/src/i18n/client";
import { localizeProduct } from "@/src/i18n/product";
import type { Locale } from "@/src/i18n/config";
import type { Product } from "@/src/types";

// Счётчик товаров с числом. В казахском существительное после числа не
// склоняется («5 тауар»), в английском item/items, в русском — полные формы.
function itemCountLabel(n: number, locale: Locale) {
  if (locale === "en") return `${n} ${n === 1 ? "item" : "items"}`;
  if (locale === "kk") return `${n} тауар`;
  const last = n % 10;
  const lastTwo = n % 100;
  const word =
    lastTwo >= 11 && lastTwo <= 19
      ? "товаров"
      : last === 1
        ? "товар"
        : last >= 2 && last <= 4
          ? "товара"
          : "товаров";
  return `${n} ${word}`;
}

export default function CartSheet() {
  const t = useT();
  const locale = useLocale();
  const { items, totalAmount, totalItems, remove, updateQty, add, clear } = useCart();
  const [isOpen, setIsOpen] = useState(false);
  const [popular, setPopular] = useState<Product[]>([]);
  const hasLoadedPopular = useRef(false);

  // Прогресс до бесплатной доставки (минимума заказа больше нет).
  const progress = Math.min((totalAmount / FREE_DELIVERY_THRESHOLD) * 100, 100);
  const freeDeliveryReached = totalAmount >= FREE_DELIVERY_THRESHOLD;
  const canCheckout = totalItems > 0;

  // Fetch popular products once on first open
  useEffect(() => {
    if (!isOpen || hasLoadedPopular.current) return;
    hasLoadedPopular.current = true;
    fetch("/api/catalog/popular")
      .then((r) => r.json())
      .then((data) => setPopular(data.products ?? []))
      .catch(() => {});
  }, [isOpen]);

  // Блокируем прокрутку body, пока лист открыт — через общий реф-счётчик, чтобы не
  // конфликтовать со шторкой товара (она тоже блокирует скролл).
  useEffect(() => {
    if (!isOpen) return;
    lockBodyScroll();
    return () => unlockBodyScroll();
  }, [isOpen]);

  // Закрываем корзину при смене маршрута. CartSheet смонтирован в layout и переживает
  // клиентскую навигацию — иначе полноэкранный бэкдроп (fixed inset-0) остаётся поверх
  // новой страницы и глотает все клики до перезагрузки. Сброс делаем ВО ВРЕМЯ РЕНДЕРА
  // (паттерн React «reset state on value change»), а не в эффекте.
  const pathname = usePathname();
  const [lastPath, setLastPath] = useState(pathname);
  if (pathname !== lastPath) {
    setLastPath(pathname);
    if (isOpen) setIsOpen(false);
  }

  return (
    <>
      {/* Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-espresso/40 backdrop-blur-sm"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Плавающая мини-корзина — стеклянная пилюля; видна, когда лист закрыт и корзина не пуста */}
      {!isOpen && totalItems > 0 && (
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          className="fixed left-1/2 z-30 flex -translate-x-1/2 items-center gap-3 rounded-full border border-white/70 bg-white/90 py-2 pl-5 pr-2 shadow-lg backdrop-blur-xl transition hover:shadow-xl bottom-[calc(76px_+_env(safe-area-inset-bottom))] lg:bottom-[calc(20px_+_env(safe-area-inset-bottom))]"
          aria-label={`Открыть корзину, товаров: ${totalItems}, набрано ${Math.round(progress)}% до бесплатной доставки`}
        >
          <span className="flex min-w-0 flex-col text-left">
            <span className="whitespace-nowrap font-data text-sm font-bold tabular-nums text-dark">
              {formatPrice(totalAmount)}
            </span>
            <span className="whitespace-nowrap text-[11px] text-muted">
              {itemCountLabel(totalItems, locale)}
            </span>
          </span>
          <span className="ml-auto flex items-center">
            {items.slice(0, 3).map(({ product }, index) => (
              <span
                key={product.id}
                className={`relative h-10 w-10 overflow-hidden rounded-full border-2 border-white bg-cream ${
                  index > 0 ? "-ml-3" : ""
                }`}
              >
                <FallbackImage
                  src={product.images[0]}
                  alt=""
                  fill
                  sizes="40px"
                  className="object-cover"
                />
              </span>
            ))}
            {items.length > 3 && (
              <span className="-ml-3 flex h-10 w-10 items-center justify-center rounded-full border-2 border-white bg-coral font-data text-xs font-bold text-white">
                +{items.length - 3}
              </span>
            )}
          </span>
        </button>
      )}

      {/* Sheet outer container — horizontally centers panel; closes sheet when clicking backdrop area */}
      <div
        className={`fixed z-50 flex justify-center ${
          isOpen ? "inset-0 items-end" : "bottom-0 left-0 right-0 pointer-events-none"
        }`}
        onClick={isOpen ? () => setIsOpen(false) : undefined}
      >

      {/* Sheet panel */}
      <div
        className="pointer-events-auto flex w-full max-w-lg flex-col overflow-hidden rounded-t-3xl bg-cream shadow-xl transition-transform duration-300"
        style={{
          maxHeight: "92vh",
          minHeight: isOpen ? "70vh" : undefined,
          paddingBottom: "env(safe-area-inset-bottom, 0px)",
          transform: isOpen ? "translateY(0)" : "translateY(calc(100% + 40px))",
        }}
        onClick={(e) => e.stopPropagation()}
        aria-hidden={!isOpen}
      >
        {/* Handle bar — always visible */}
        <div className="relative flex h-12 shrink-0 items-center justify-center rounded-t-3xl bg-white px-4">
          {/* Drag pill */}
          <span className="absolute left-1/2 top-2.5 h-1 w-10 -translate-x-1/2 rounded-full bg-black/15" />

          <button
            type="button"
            className="flex flex-1 items-center justify-center pt-1"
            onClick={() => setIsOpen((v) => !v)}
            aria-label={isOpen ? "Закрыть корзину" : "Открыть корзину"}
          >
            <span className="text-[13.5px] font-semibold text-muted">
              {totalItems > 0
                ? itemCountLabel(totalItems, locale)
                : t("Корзина пуста")}
            </span>
          </button>
        </div>

        {/* Expanded content */}
        <div
          className={`flex min-h-0 flex-1 flex-col ${isOpen ? "" : "pointer-events-none select-none"}`}
        >
          {/* Header */}
          <div className="flex shrink-0 items-center gap-3 border-b border-black/10 bg-white px-5 py-3">
            <button
              type="button"
              onClick={clear}
              disabled={items.length === 0}
              className="flex h-9 w-9 items-center justify-center rounded-full border border-black/10 text-muted transition hover:bg-black/5 hover:text-coral disabled:opacity-40"
              aria-label={t("Очистить корзину")}
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                />
              </svg>
            </button>
            <h2 className="flex-1 text-center font-display text-[17px] font-extrabold text-dark">{t("Ваша корзина")}</h2>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="flex h-9 w-9 items-center justify-center rounded-full border border-black/10 text-dark transition hover:bg-black/5"
              aria-label={t("Закрыть")}
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>

          {/* Scrollable area */}
          <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4">
            {/* Прогресс до бесплатной доставки */}
            {items.length > 0 && (
              <div className="rounded-lg bg-white p-4 shadow-xs">
                <div className="mb-3 flex items-center gap-3">
                  <span className={`text-[13.5px] font-semibold ${freeDeliveryReached ? "text-success" : "text-dark"}`}>
                    {freeDeliveryReached
                      ? t("Бесплатная доставка")
                      : `${t("До бесплатной доставки")} ${formatPrice(FREE_DELIVERY_THRESHOLD - totalAmount)}`}
                  </span>
                  <span className="ml-auto whitespace-nowrap font-data text-[13.5px] font-bold tabular-nums text-dark">
                    {formatPrice(totalAmount)} / {formatPrice(FREE_DELIVERY_THRESHOLD)}
                  </span>
                </div>
                <div className="h-2.5 overflow-hidden rounded-full bg-cream-warm">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${
                      freeDeliveryReached ? "bg-gradient-to-r from-success to-success" : "bg-gradient-to-r from-accent-400 to-coral"
                    }`}
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>
            )}

            {/* Items */}
            {items.length === 0 ? (
              <p className="py-10 text-center text-[15px] text-muted">{t("Корзина пуста")}</p>
            ) : (
              <ul className="space-y-3">
                {items.map(({ product, qty }) => (
                  <li
                    key={product.id}
                    className="relative flex items-center gap-3 rounded-lg bg-white p-3 shadow-xs"
                  >
                    <div className="relative h-[72px] w-[72px] shrink-0 overflow-hidden rounded-md bg-cream">
                      <FallbackImage
                        src={product.images[0]}
                        alt={product.name}
                        fill
                        sizes="72px"
                        className="object-cover"
                      />
                    </div>

                    <div className="min-w-0 flex-1">
                      <p className="text-[11px] font-semibold uppercase tracking-[.06em] text-muted">
                        {t(product.unit)}
                      </p>
                      <p className="truncate text-[15px] font-semibold text-dark">
                        {localizeProduct(product, locale).name}
                      </p>
                      <p className="mt-1 font-data text-[15px] font-bold tabular-nums text-dark">
                        {formatPrice(product.price * qty)}
                      </p>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <div className="inline-flex items-center gap-0.5 rounded-full border border-black/10 bg-cream p-1">
                        <button
                          type="button"
                          onClick={() => updateQty(product.id, qty - product.step_qty)}
                          className="flex h-8 w-8 items-center justify-center rounded-full bg-white text-lg font-bold text-dark shadow-xs transition hover:bg-coral hover:text-white"
                          aria-label={t("Уменьшить количество")}
                        >
                          −
                        </button>
                        <span className="w-8 text-center font-data text-[15px] font-bold tabular-nums">
                          {qty}
                        </span>
                        <button
                          type="button"
                          onClick={() => updateQty(product.id, qty + product.step_qty)}
                          className="flex h-8 w-8 items-center justify-center rounded-full bg-coral text-lg font-bold text-white shadow-xs transition hover:bg-coral-hover"
                          aria-label={t("Увеличить количество")}
                        >
                          +
                        </button>
                      </div>
                      <button
                        type="button"
                        onClick={() => remove(product.id)}
                        className="flex h-9 w-7 items-center justify-center text-xl leading-none text-black/30 transition hover:text-coral"
                        aria-label={`Удалить ${product.name}`}
                      >
                        ×
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}

            {/* Popular products */}
            {popular.length > 0 && (
              <div>
                <p className="mb-3 font-display text-[15px] font-extrabold text-dark">{t("Часто добавляют")}</p>
                <div className="flex gap-3 overflow-x-auto pb-1">
                  {popular.map((p) => (
                    <div
                      key={p.id}
                      className="flex w-32 shrink-0 flex-col rounded-lg bg-white p-2 shadow-xs"
                    >
                      <div className="relative h-24 overflow-hidden rounded-md bg-cream">
                        <FallbackImage
                          src={p.images[0]}
                          alt={p.name}
                          fill
                          sizes="128px"
                          className="object-cover"
                        />
                      </div>
                      <p className="mt-2 line-clamp-2 text-[11px] font-semibold text-dark">
                        {localizeProduct(p, locale).name}
                      </p>
                      <div className="mt-auto flex items-center justify-between pt-2">
                        <p className="font-data text-[13.5px] font-bold tabular-nums text-dark">{formatPrice(p.price)}</p>
                        <button
                          type="button"
                          onClick={() => add(p, 1)}
                          className="flex h-7 w-7 items-center justify-center rounded-full border border-coral text-base font-bold text-coral transition hover:bg-coral hover:text-white"
                          aria-label={`Добавить ${p.name} в корзину`}
                        >
                          +
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Footer: total + checkout */}
          <div className="shrink-0 border-t border-black/10 bg-white/90 px-5 pb-6 pt-4 backdrop-blur-xl">
            <div className="mb-3 flex items-baseline gap-3 border-t border-black/10 pt-3">
              <span className="text-[13.5px] text-muted">{t("Итого")}</span>
              <span className="ml-auto font-display text-2xl font-extrabold tabular-nums text-dark">
                {formatPrice(totalAmount)}
              </span>
            </div>
            {canCheckout && (
              <Link
                href="/checkout"
                onClick={() => setIsOpen(false)}
                className="block w-full rounded-full bg-coral py-3.5 text-center text-[15px] font-bold text-white shadow-accent transition-colors hover:bg-coral-hover"
              >{t("Оформить заказ")}</Link>
            )}
          </div>
        </div>
      </div>
      </div>
    </>
  );
}
