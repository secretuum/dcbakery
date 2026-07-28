"use client";

import { FREE_DELIVERY_THRESHOLD, deliveryFee } from "@/app/constants";
import { useRouter } from "next/navigation";
import { Button } from "@/src/components/ui/Button";
import { useCart } from "@/src/contexts/CartContext";
import { formatPrice } from "@/src/lib/format";
import { useT } from "@/src/i18n/client";

export function CartSummary() {
  const t = useT();
  const { items, totalAmount, totalItems } = useCart();
  const router = useRouter();
  const delivery = deliveryFee(totalAmount);
  const grandTotal = totalAmount + delivery;
  const freeDelivery = delivery === 0;
  const progress = Math.min(100, Math.round((totalAmount / FREE_DELIVERY_THRESHOLD) * 100));
  const missingToFree = Math.max(FREE_DELIVERY_THRESHOLD - totalAmount, 0);
  const canCheckout = items.length > 0;
  const hasQuoteItems = items.some((item) => item.product.price <= 0);

  return (
    <aside className="rounded-card border border-black/10 bg-white p-5 shadow-sm lg:sticky lg:top-28">
      <p className="text-xs font-semibold uppercase tracking-[.15em] text-muted">{t("Корзина")}</p>
      <h2 className="mt-2 font-display text-lg font-bold tracking-tight">{t("Итого по заявке")}</h2>

      <div className="mt-6 space-y-3 text-sm font-semibold">
        <div className="flex items-center justify-between gap-4">
          <span className="text-muted">{t("Товаров")}</span>
          <span className="font-data">{totalItems}</span>
        </div>
        <div className="flex items-center justify-between gap-4">
          <span className="text-muted">{t("Подытог")}</span>
          <span className="font-data">{formatPrice(totalAmount)}</span>
        </div>
        <div className="flex items-center justify-between gap-4">
          <span className="text-muted">{t("Доставка")}</span>
          <span className={freeDelivery ? "font-data text-success" : "font-data"}>
            {freeDelivery ? t("Бесплатно") : formatPrice(delivery)}
          </span>
        </div>
        <div className="border-t border-black/10 pt-4">
          <div className="flex items-end justify-between gap-4">
            <span className="text-muted">{t("Итого")}</span>
            <span className="font-data text-xl font-bold text-coral">{formatPrice(grandTotal)}</span>
          </div>
        </div>
      </div>

      <div className="mt-6 rounded-md bg-cream-deep p-4">
        <div className="flex items-center justify-between gap-3 text-xs font-semibold uppercase tracking-[.08em] text-ink-soft">
          <span>{t("Бесплатная доставка")}</span>
          <span className="font-data">{formatPrice(FREE_DELIVERY_THRESHOLD)}</span>
        </div>
        <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-white">
          <div className="h-full rounded-full bg-coral transition-all" style={{ width: `${progress}%` }} />
        </div>
        <p className="mt-3 text-sm leading-6 text-ink-soft">
          {freeDelivery
            ? t("Доставка бесплатная — сумма достаточна.")
            : t("Добавьте ещё ${amount} — и доставка станет бесплатной.", {
                amount: formatPrice(missingToFree),
              })}
        </p>
        {hasQuoteItems ? (
          <p className="mt-2 text-xs font-semibold leading-5 text-burgundy">
            {t("В корзине есть товары с ценой по запросу. Их сумму подтвердит менеджер.")}
          </p>
        ) : null}
      </div>

      <Button onClick={() => router.push("/checkout")} disabled={!canCheckout} block className="mt-6">
        {t("Оформить заявку")}
      </Button>
    </aside>
  );
}
