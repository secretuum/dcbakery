"use client";

import { FREE_DELIVERY_THRESHOLD, deliveryFee } from "@/app/constants";
import { useRouter } from "next/navigation";
import { Button } from "@/src/components/ui/Button";
import { useCart } from "@/src/contexts/CartContext";
import { formatPrice } from "@/src/lib/format";
import { useLocale, useT } from "@/src/i18n/client";
import { withLocale } from "@/src/i18n/routing";

export function CartSummary() {
  const t = useT();
  const locale = useLocale();
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
    <aside className="rounded-2xl bg-white p-5 shadow-sm lg:sticky lg:top-28">
      <h2 className="font-display text-[17px] font-bold tracking-tight text-dark">{t("Итог заявки")}</h2>

      {/* summary rows */}
      <div className="mt-5 space-y-3">
        <div className="flex gap-3 text-[13.5px]">
          <span className="text-muted">{t("Позиций")}</span>
          <span className="ml-auto font-semibold tabular-nums text-dark">{items.length}</span>
        </div>
        <div className="flex gap-3 text-[13.5px]">
          <span className="text-muted">{t("Единиц товара")}</span>
          <span className="ml-auto font-semibold tabular-nums text-dark">{totalItems}</span>
        </div>
        <div className="flex gap-3 text-[13.5px]">
          <span className="text-muted">{t("Доставка")}</span>
          <span
            className={`ml-auto font-semibold tabular-nums ${freeDelivery ? "text-success" : "text-dark"}`}
          >
            {freeDelivery ? t("Бесплатно") : formatPrice(delivery)}
          </span>
        </div>

        {/* total */}
        <div className="flex items-end gap-3 border-t border-black/10 pt-3">
          <span className="text-[13.5px] text-muted">{t("К оплате")}</span>
          <span className="ml-auto font-display text-2xl font-extrabold tabular-nums text-coral">
            {formatPrice(grandTotal)}
          </span>
        </div>
      </div>

      {/* free-delivery progress (minbar) */}
      <div className="mt-5 rounded-md bg-cream-deep p-4">
        <div className="flex items-center justify-between gap-3 text-[11px] font-bold uppercase tracking-[.12em] text-ink-soft">
          <span>{t("Бесплатная доставка")}</span>
          <span className="font-data tracking-normal">{formatPrice(FREE_DELIVERY_THRESHOLD)}</span>
        </div>
        <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-white">
          <div className="h-full rounded-full bg-coral transition-all" style={{ width: `${progress}%` }} />
        </div>
        <p className="mt-3 text-[13.5px] leading-6 text-ink-soft">
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

      <Button onClick={() => router.push(withLocale("/checkout", locale))} disabled={!canCheckout} block className="mt-5">
        {t("Оформить заявку")}
      </Button>
    </aside>
  );
}
