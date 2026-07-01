"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { FallbackImage } from "@/src/components/ui/FallbackImage";
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

export default function CartSheet() {
  const { items, totalAmount, totalItems, remove, updateQty, add } = useCart();
  const [isOpen, setIsOpen] = useState(false);
  const [popular, setPopular] = useState<Product[]>([]);
  const hasLoadedPopular = useRef(false);

  const fillPct = Math.min((totalAmount / PROGRESS_MAX) * 100, 100);
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

      {/* Sheet outer container — horizontally centers panel; closes sheet when clicking backdrop area */}
      <div
        className={`fixed z-50 flex justify-center ${
          isOpen ? "inset-0 items-end" : "bottom-0 left-0 right-0"
        }`}
        onClick={isOpen ? () => setIsOpen(false) : undefined}
      >

      {/* Sheet panel */}
      <div
        className="flex w-full max-w-lg flex-col rounded-t-3xl bg-white shadow-[0_-8px_30px_rgba(0,0,0,0.12)] transition-transform duration-300"
        style={{
          maxHeight: "90vh",
          transform: isOpen ? "translateY(0)" : "translateY(calc(100% - 3.5rem))",
        }}
        onClick={(e) => e.stopPropagation()}
        aria-hidden={!isOpen}
      >
        {/* Handle bar — always visible */}
        <div className="relative flex h-14 shrink-0 items-center justify-between px-4">
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
            {totalItems > 0 && !isOpen && (
              <span className="text-sm font-bold text-gray-800">
                {formatPrice(totalAmount)}
              </span>
            )}
          </button>

          {canCheckout && !isOpen && (
            <Link
              href="/checkout"
              onClick={(e) => e.stopPropagation()}
              className="ml-3 rounded-xl bg-green-500 px-4 py-1.5 text-sm font-semibold text-white transition-colors hover:bg-green-600"
            >
              Оформить
            </Link>
          )}
        </div>

        {/* Expanded content */}
        <div
          className={`flex min-h-0 flex-1 flex-col ${isOpen ? "" : "pointer-events-none select-none"}`}
        >
          {/* Header */}
          <div className="flex shrink-0 items-center border-b border-gray-100 px-4 py-3">
            <svg
              className="h-5 w-5 text-gray-500"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z"
              />
            </svg>
            <h2 className="flex-1 text-center text-sm font-semibold text-gray-800">
              Ваша корзина
            </h2>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="text-gray-400 hover:text-gray-600"
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
              <ul className="space-y-3">
                {items.map(({ product, qty }) => (
                  <li key={product.id} className="flex items-center gap-3">
                    <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-gray-50">
                      <FallbackImage
                        src={product.images[0]}
                        alt={product.name}
                        fill
                        sizes="64px"
                        className="object-cover"
                      />
                    </div>

                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-gray-800">
                        {product.name}
                      </p>
                      <p className="text-xs text-gray-400">{product.unit}</p>
                      <p className="text-sm font-bold text-gray-900">
                        {formatPrice(product.price * qty)}
                      </p>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => updateQty(product.id, qty - product.step_qty)}
                        className="flex h-7 w-7 items-center justify-center rounded-lg bg-gray-100 text-sm font-bold text-gray-600 hover:bg-gray-200"
                      >
                        −
                      </button>
                      <span className="w-6 text-center text-sm font-semibold tabular-nums">
                        {qty}
                      </span>
                      <button
                        type="button"
                        onClick={() => updateQty(product.id, qty + product.step_qty)}
                        className="flex h-7 w-7 items-center justify-center rounded-lg bg-gray-100 text-sm font-bold text-gray-600 hover:bg-gray-200"
                      >
                        +
                      </button>
                      <button
                        type="button"
                        onClick={() => remove(product.id)}
                        className="ml-1 text-lg leading-none text-gray-300 hover:text-red-400"
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
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">
                  Популярное
                </p>
                <div className="flex gap-3 overflow-x-auto pb-1">
                  {popular.map((p) => (
                    <div key={p.id} className="flex w-28 shrink-0 flex-col gap-1">
                      <div className="relative h-20 overflow-hidden rounded-xl bg-gray-50">
                        <FallbackImage
                          src={p.images[0]}
                          alt={p.name}
                          fill
                          sizes="112px"
                          className="object-cover"
                        />
                      </div>
                      <p className="line-clamp-2 text-xs font-semibold text-gray-700">{p.name}</p>
                      <p className="text-xs text-gray-400">{formatPrice(p.price)}</p>
                      <button
                        type="button"
                        onClick={() => add(p)}
                        className="mt-auto rounded-lg bg-green-50 py-1 text-xs font-bold text-green-600 hover:bg-green-100"
                      >
                        + В корзину
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Footer: total + checkout */}
          <div className="shrink-0 border-t border-gray-100 px-4 pb-6 pt-4">
            <div className="mb-3 flex items-baseline justify-between">
              <span className="text-sm text-gray-500">Итого</span>
              <span className="text-xl font-black text-gray-900">{formatPrice(totalAmount)}</span>
            </div>
            {canCheckout ? (
              <Link
                href="/checkout"
                onClick={() => setIsOpen(false)}
                className="block w-full rounded-xl bg-green-500 py-3 text-center text-sm font-semibold text-white transition-colors hover:bg-green-600"
              >
                Оформить заказ
              </Link>
            ) : (
              <button
                disabled
                className="w-full cursor-not-allowed rounded-xl bg-gray-200 py-3 text-sm font-semibold text-gray-400"
              >
                Минимум {formatPrice(MIN_ORDER_AMOUNT)}
              </button>
            )}
          </div>
        </div>
      </div>
      </div>
    </>
  );
}
