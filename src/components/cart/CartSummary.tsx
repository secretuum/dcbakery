"use client";

import { MIN_ORDER_AMOUNT } from "@/app/constants";
import { useRouter } from "next/navigation";
import { Button } from "@/src/components/ui/Button";
import { useCart } from "@/src/contexts/CartContext";
import { useToast } from "@/src/contexts/ToastContext";
import { formatPrice } from "@/src/lib/format";

type CartSummaryProps = {
  compact?: boolean;
};

function getProgress(totalAmount: number) {
  return Math.min(100, Math.round((totalAmount / MIN_ORDER_AMOUNT) * 100));
}

export function CartSummary({ compact = false }: CartSummaryProps) {
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

  if (compact) {
    return (
      <div className="flex items-center justify-between gap-3 border-t border-black/10 bg-white/95 px-4 py-3 shadow-[0_-12px_40px_rgba(28,28,28,0.10)] backdrop-blur">
        <div>
          <p className="text-xs font-black uppercase text-muted">Итого</p>
          <p className="text-xl font-black text-dark">{formatPrice(totalAmount)}</p>
        </div>
        <Button onClick={handleCheckout} disabled={!canCheckout} className="min-h-11 px-4">
          Оформить
        </Button>
      </div>
    );
  }

  return (
    <aside className="rounded-card bg-white p-5 shadow-sm lg:sticky lg:top-28">
      <p className="text-sm font-black uppercase text-raspberry">Корзина</p>
      <h2 className="mt-2 text-lg font-semibold tracking-tight">Итого по заявке</h2>

      <div className="mt-6 space-y-3 text-sm font-bold">
        <div className="flex items-center justify-between gap-4">
          <span className="text-muted">Товаров</span>
          <span>{totalItems}</span>
        </div>
        <div className="flex items-center justify-between gap-4">
          <span className="text-muted">Подытог</span>
          <span>{formatPrice(totalAmount)}</span>
        </div>
        <div className="flex items-center justify-between gap-4">
          <span className="text-muted">Доставка</span>
          <span>уточняется</span>
        </div>
        <div className="border-t border-black/10 pt-4">
          <div className="flex items-end justify-between gap-4">
            <span className="text-muted">Итого</span>
            <span className="text-xl font-black text-coral">{formatPrice(totalAmount)}</span>
          </div>
        </div>
      </div>

      <div className="mt-6">
        <div className="flex items-center justify-between gap-3 text-xs font-black uppercase text-muted">
          <span>Минимальный заказ</span>
          <span>{formatPrice(MIN_ORDER_AMOUNT)}</span>
        </div>
        <div className="mt-3 h-3 overflow-hidden rounded-badge bg-coral-light">
          <div
            className="h-full rounded-badge bg-coral transition-all"
            style={{ width: `${progress}%` }}
          />
        </div>
        <p className="mt-3 text-sm font-semibold leading-6 text-muted">
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
