"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { FallbackImage } from "@/src/components/ui/FallbackImage";
import { CartSheetAccent } from "@/src/components/ui/DecorativeShapes";
import { useCart } from "@/src/contexts/CartContext";
import { formatPrice } from "@/src/lib/format";
import { MIN_ORDER_AMOUNT } from "@/app/constants";
import type { Product } from "@/src/types";

const PROGRESS_MAX = 100_000;

function pluralItems(n: number) {
  const last = n % 10;
  const lastTwo = n % 100;
  if (lastTwo >= 11 && lastTwo <= 19) return "товаров";
  if (last === 1) return "товар";
  if (last >= 2 && last <= 4) return "товара";
  return "товаров";
}

const PILL_STRIPES =
  "repeating-linear-gradient(45deg, #f47b6f 0 12px, #fff8f6 12px 20px, #8b1a4a 20px 32px, #fff8f6 32px 40px)";

export default function CartSheet() {
  const { items, totalAmount, totalItems, remove, updateQty, add, clear } = useCart();
  const [isOpen, setIsOpen] = useState(false);
  const [popular, setPopular] = useState<Product[]>([]);
  const hasLoadedPopular = useRef(false);

  const fillPct = Math.min((totalAmount / PROGRESS_MAX) * 100, 100);
  const pillFillPct = Math.min((totalAmount / MIN_ORDER_AMOUNT) * 100, 100);
  const canCheckout = totalAmount >= MIN_ORDER_AMOUNT;

  // Fetch popular products once on first open
  useEffect(() => {
    if (!isOpen || hasLoadedPopular.current) return;
    hasLoadedPopular.current = true;
    fetch("/api/catalog/popular")
      .then((r) => r.json())
      .then((data) => setPopular(data.products ?? []))
      .catch(() => {});
  }, [isOpen]);

  // Lock body scroll while sheet is open
  useEffect(() => {
    document.body.style.overflow = isOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  return (
    <>
      {/* Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/40"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Floating cart pill (Drinkit-style) — visible when sheet is closed and cart is not empty */}
      {!isOpen && totalItems > 0 && (
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          className="fixed left-1/2 z-50 flex -translate-x-1/2 items-center gap-3 overflow-hidden rounded-full bg-white py-2 pl-5 pr-2 shadow-[0_8px_30px_rgba(0,0,0,0.18)] transition hover:shadow-[0_10px_36px_rgba(0,0,0,0.22)]"
          style={{ bottom: "calc(1.25rem + env(safe-area-inset-bottom, 0px))" }}
          aria-label={`Открыть корзину, товаров: ${totalItems}, набрано ${Math.round(pillFillPct)}% минимального заказа`}
        >
          {/* Заполнение капсулы полосатым паттерном по мере набора минимума 15 000 ₸ */}
          <span
            aria-hidden
            className="absolute inset-y-0 left-0 transition-[width] duration-500 ease-out"
            style={{ width: `${pillFillPct}%`, background: PILL_STRIPES, opacity: 0.3 }}
          />
          <span className="relative whitespace-nowrap text-lg font-bold text-dark">
            {formatPrice(totalAmount)}
          </span>
          <span className="relative flex items-center">
            {items.slice(0, 3).map(({ product }, index) => (
              <span
                key={product.id}
                className={`relative h-10 w-10 overflow-hidden rounded-full border-2 border-white bg-gray-50 ${
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
              <span className="-ml-3 flex h-10 w-10 items-center justify-center rounded-full border-2 border-white bg-gray-100 text-xs font-bold text-gray-600">
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
        className="glass pointer-events-auto flex w-full max-w-lg flex-col rounded-t-3xl shadow-[0_-8px_30px_rgba(0,0,0,0.12)] transition-transform duration-300"
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
        <div className="relative flex h-14 shrink-0 items-center justify-between px-4">
          <CartSheetAccent />
          {/* Drag pill */}
          <span className="absolute left-1/2 top-2 h-1 w-10 -translate-x-1/2 rounded-full bg-gray-200" />

          <button
            type="button"
            className="flex flex-1 items-center justify-between"
            onClick={() => setIsOpen((v) => !v)}
            aria-label={isOpen ? "Закрыть корзину" : "Открыть корзину"}
          >
            <span className="text-sm font-semibold text-gray-600">
              {totalItems > 0
                ? `${totalItems} ${pluralItems(totalItems)}`
                : "Корзина пуста"}
            </span>
          </button>
        </div>

        {/* Expanded content */}
        <div
          className={`flex min-h-0 flex-1 flex-col ${isOpen ? "" : "pointer-events-none select-none"}`}
        >
          {/* Header */}
          <div className="flex shrink-0 items-center border-b border-gray-100 px-4 py-3">
            <button
              type="button"
              onClick={clear}
              disabled={items.length === 0}
              className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-50 text-gray-400 transition hover:text-red-400 disabled:opacity-40"
              aria-label="Очистить корзину"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                />
              </svg>
            </button>
            <h2 className="flex-1 text-center text-base font-semibold text-gray-800">
              Ваша корзина
            </h2>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-50 text-gray-500 transition hover:text-gray-700"
              aria-label="Закрыть"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
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
          <div className="flex-1 space-y-4 overflow-y-auto px-4 py-4">
            {/* Progress bar */}
            <div className="relative h-1.5 overflow-visible rounded-full bg-gray-100">
              <div
                className={`absolute inset-y-0 left-0 rounded-full transition-all duration-300 ${
                  canCheckout ? "bg-green-500" : "bg-gray-300"
                }`}
                style={{ width: `${fillPct}%` }}
              />
              {[50, 75].map((pos) => (
                <span
                  key={pos}
                  className="absolute top-1/2 z-10 h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-yellow-400"
                  style={{ left: `${pos}%` }}
                />
              ))}
            </div>

            {/* Items */}
            {items.length === 0 ? (
              <p className="py-10 text-center text-sm text-gray-400">Корзина пуста</p>
            ) : (
              <ul className="divide-y divide-gray-100">
                {items.map(({ product, qty }) => (
                  <li key={product.id} className="flex items-center gap-3 py-3 first:pt-0">
                    <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-xl bg-gray-50">
                      <FallbackImage
                        src={product.images[0]}
                        alt={product.name}
                        fill
                        sizes="80px"
                        className="object-cover"
                      />
                    </div>

                    <div className="min-w-0 flex-1">
                      <p className="text-xs text-gray-400">{product.unit}</p>
                      <p className="truncate text-base font-semibold text-gray-800">
                        {product.name}
                      </p>
                      <p className="mt-1 text-base font-bold text-gray-900">
                        {formatPrice(product.price * qty)}
                      </p>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => updateQty(product.id, qty - product.step_qty)}
                        className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-100 text-lg font-bold text-gray-600 hover:bg-gray-200"
                        aria-label="Уменьшить количество"
                      >
                        −
                      </button>
                      <span className="w-8 text-center text-base font-semibold tabular-nums">
                        {qty}
                      </span>
                      <button
                        type="button"
                        onClick={() => updateQty(product.id, qty + product.step_qty)}
                        className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-100 text-lg font-bold text-gray-600 hover:bg-gray-200"
                        aria-label="Увеличить количество"
                      >
                        +
                      </button>
                      <button
                        type="button"
                        onClick={() => remove(product.id)}
                        className="flex h-10 w-8 items-center justify-center rounded-lg text-xl leading-none text-gray-300 hover:text-red-400"
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
                <p className="mb-3 text-lg font-semibold text-gray-900">Часто добавляют</p>
                <div className="flex gap-3 overflow-x-auto pb-1">
                  {popular.map((p) => (
                    <div
                      key={p.id}
                      className="glass flex w-32 shrink-0 flex-col rounded-2xl p-2"
                    >
                      <div className="relative h-24 overflow-hidden rounded-xl bg-coral-light">
                        <FallbackImage
                          src={p.images[0]}
                          alt={p.name}
                          categoryId={p.category_id}
                          categorySlug={p.category?.slug}
                          fill
                          sizes="128px"
                          className="object-cover"
                        />
                      </div>
                      <p className="mt-2 line-clamp-2 text-xs font-semibold text-gray-700">
                        {p.name}
                      </p>
                      <div className="mt-auto flex items-center justify-between pt-2">
                        <p className="text-sm font-bold text-gray-900">{formatPrice(p.price)}</p>
                        <button
                          type="button"
                          onClick={() => add(p, 1)}
                          className="flex h-8 w-8 items-center justify-center rounded-full bg-white text-lg font-bold text-gray-700 shadow-sm transition hover:bg-gray-100"
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
          <div className="shrink-0 border-t border-gray-100 px-4 pb-6 pt-4">
            <div className="mb-3 flex items-end justify-between">
              <span className="pb-1 text-sm text-gray-500">
                {totalItems > 0 ? `${totalItems} ${pluralItems(totalItems)}` : ""}
              </span>
              <div className="text-right">
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
                  Итого
                </p>
                <p className="text-2xl font-black leading-tight text-gray-900">
                  {formatPrice(totalAmount)}
                </p>
              </div>
            </div>
            {canCheckout ? (
              <Link
                href="/checkout"
                onClick={() => setIsOpen(false)}
                className="block w-full rounded-full bg-coral py-3.5 text-center text-base font-semibold text-white transition-colors hover:bg-coral-hover"
              >
                Оформить заказ
              </Link>
            ) : (
              <button
                disabled
                className="w-full cursor-not-allowed rounded-full bg-gray-200 py-3.5 text-base font-semibold text-gray-400"
              >
                Минимум {formatPrice(MIN_ORDER_AMOUNT)} — осталось {formatPrice(MIN_ORDER_AMOUNT - totalAmount)}
              </button>
            )}
          </div>
        </div>
      </div>
      </div>
    </>
  );
}
