"use client";

import Link from "next/link";
import { useCart } from "@/src/contexts/CartContext";
import { MIN_ORDER_AMOUNT } from "@/app/constants";

const PROGRESS_MAX = 100_000;

function fmt(n: number) {
  return n.toLocaleString("ru-RU", { maximumFractionDigits: 0 }) + " ₸";
}

export default function CartBottomBar() {
  const { items, totalAmount } = useCart();

  const fillPct = Math.min((totalAmount / PROGRESS_MAX) * 100, 100);
  const canCheckout = totalAmount >= MIN_ORDER_AMOUNT;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 bg-white shadow-[0_-4px_20px_rgba(0,0,0,0.08)]">
      <div className="mx-auto max-w-4xl px-4 py-3 space-y-3">
        {items.length === 0 ? (
          <p className="py-1 text-center text-sm text-gray-400">Корзина пуста</p>
        ) : (
          <>
            <ul className="max-h-32 space-y-1 overflow-y-auto text-sm">
              {items.map(({ product, qty }) => (
                <li key={product.id} className="flex justify-between gap-2">
                  <span className="truncate text-gray-700">{product.name}</span>
                  <span className="shrink-0 text-gray-500">
                    {qty} {product.unit} — {fmt(product.price * qty)}
                  </span>
                </li>
              ))}
            </ul>

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

            {canCheckout ? (
              <Link
                href="/checkout"
                className="block w-full rounded-xl bg-green-500 py-3 text-center font-semibold text-white transition-colors hover:bg-green-600"
              >
                Оформить заказ — {fmt(totalAmount)}
              </Link>
            ) : (
              <button
                disabled
                className="w-full cursor-not-allowed rounded-xl bg-gray-200 py-3 font-semibold text-gray-400"
              >
                Минимум 15 000 ₸
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
