"use client";

import { MIN_ORDER_AMOUNT } from "@/app/constants";
import { useRouter } from "next/navigation";
import { Button } from "@/src/components/ui/Button";
import { useCart } from "@/src/contexts/CartContext";
import { useToast } from "@/src/contexts/ToastContext";
import { formatPrice } from "@/src/lib/format";

function getProgress(totalAmount: number) {
  return Math.min(100, Math.round((totalAmount / MIN_ORDER_AMOUNT) * 100));
}

export function CartSummary() {
  const { items, totalAmount, totalItems } = useCart();
  const { showToast } = useToast();
  const router = useRouter();
  const missingAmount = Math.max(MIN_ORDER_AMOUNT - totalAmount, 0);
  const canCheckout = items.length > 0 && totalAmount >= MIN_ORDER_AMOUNT;
  const progress = getProgress(totalAmount);
  const hasQuoteItems = items.some((item) => item.product.price <= 0);

  function handleCheckout() {
    if (!canCheckout) {
      showToast(`Добавьте еще на ${formatPrice(missingAmount)} до минимального заказа`, "info");
      return;
    }

    router.push("/checkout");
  }

  return (
    <aside className="rounded-card border border-black/10 bg-white p-5 lg:sticky lg:top-28">
      <p className="text-xs font-semibold uppercase tracking-[.15em] text-muted">Корзина</p>
      <h2 className="mt-2 font-display text-lg font-semibold tracking-tight">Итого по заявке</h2>

      <div className="mt-6 space-y-3 text-sm font-semibold">
        <div className="flex items-center justify-between gap-4">
          <span className="text-muted">Товаров</span>
          <span className="font-data">{totalItems}</span>
        </div>
        <div className="flex items-center justify-between gap-4">
          <span className="text-muted">Подытог</span>
          <span className="font-data">{formatPrice(totalAmount)}</span>
        </div>
        <div className="flex items-center justify-between gap-4">
          <span className="text-muted">Доставка</span>
          <span>уточняется</span>
        </div>
        <div className="border-t border-black/10 pt-4">
          <div className="flex items-end justify-between gap-4">
            <span className="text-muted">Итого</span>
            <span className="font-data text-xl font-bold text-coral">{formatPrice(totalAmount)}</span>
          </div>
        </div>
      </div>

      <div className="mt-6">
        <div className="flex items-center justify-between gap-3 text-xs font-semibold uppercase tracking-[.08em] text-muted">
          <span>Минимальный заказ</span>
          <span className="font-data">{formatPrice(MIN_ORDER_AMOUNT)}</span>
        </div>
        <div className="mt-3 h-3 overflow-hidden rounded-badge bg-coral-light">
          <div
            className="h-full rounded-badge bg-coral transition-all"
            style={{ width: `${progress}%` }}
          />
        </div>
        <p className="mt-3 text-sm leading-6 text-muted">
          {canCheckout
            ? "Минимальная сумма набрана, заявку можно оформлять."
            : `До минимального заказа осталось ${formatPrice(missingAmount)}.`}
        </p>
        {hasQuoteItems ? (
          <p className="mt-2 text-xs font-semibold leading-5 text-burgundy">
            В корзине есть товары с ценой по запросу. Их сумму подтвердит менеджер.
          </p>
        ) : null}
      </div>

      <Button onClick={handleCheckout} disabled={!canCheckout} className="mt-6 w-full">
        Оформить заявку
      </Button>
    </aside>
  );
}
