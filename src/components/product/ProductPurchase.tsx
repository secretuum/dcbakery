"use client";

import { useState } from "react";
import { Button } from "@/src/components/ui/Button";
import { useCart } from "@/src/contexts/CartContext";
import { useToast } from "@/src/contexts/ToastContext";
import { formatProductPrice } from "@/src/lib/format";
import { useT } from "@/src/i18n/client";
import type { Product } from "@/src/types";
import { QuantitySelector } from "./QuantitySelector";

type ProductPurchaseProps = {
  product: Product;
};

export function ProductPurchase({ product }: ProductPurchaseProps) {
  const t = useT();
  const [qty, setQty] = useState(Math.min(product.min_qty, product.stock_qty));
  const { add, isReady, items } = useCart();
  const { showToast } = useToast();
  const cartQty = items.find((item) => item.product.id === product.id)?.qty ?? 0;
  const availableToAdd = Math.max(product.stock_qty - cartQty, 0);
  const isInStock = isReady && product.stock_qty >= product.min_qty && availableToAdd > 0;
  const totalAmount = product.price * qty;
  const totalText = product.price > 0 ? formatProductPrice(totalAmount) : t("Цена уточняется");

  function handleAddToCart() {
    const nextQty = Math.min(qty, availableToAdd);

    if (nextQty <= 0) {
      showToast(t("В корзине уже весь доступный остаток"), "info");
      return;
    }

    add(product, nextQty);
    showToast(
      nextQty < qty
        ? t("Добавлено ${nextQty} шт. с учетом остатка", { nextQty })
        : t("Товар добавлен в корзину"),
      "success",
    );
  }

  return (
    <div className="rounded-card border border-black/10 bg-white p-5 sm:p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="font-display text-sm font-semibold uppercase tracking-[.05em] text-dark">{t("Количество")}</p>
          <p className="mt-1 text-sm text-muted">
            {t("Минимум")} {product.min_qty} {product.unit}
          </p>
        </div>
        <p className="rounded-badge bg-coral-light px-3 py-1 font-data text-xs font-semibold text-coral">
          {t("${count} ${unit} в наличии", { count: product.stock_qty, unit: product.unit })}
        </p>
      </div>

      <QuantitySelector
        className="mt-5"
        disabled={!isInStock}
        maxQty={availableToAdd}
        minQty={product.min_qty}
        onChange={setQty}
        stepQty={product.step_qty}
        unit={product.unit}
        value={qty}
      />

      <div className="mt-5 flex items-end justify-between gap-4 rounded-btn border border-black/5 bg-cream px-4 py-3">
        <span className="text-sm font-semibold text-muted">{t("Итого")}</span>
        <span className="font-data text-xl font-semibold text-coral">{totalText}</span>
      </div>

      {!isInStock && cartQty >= product.stock_qty ? (
        <p className="mt-4 text-sm font-semibold text-burgundy">
          {t("В корзине уже весь доступный остаток")}.
        </p>
      ) : null}

      <Button onClick={handleAddToCart} disabled={!isInStock} className="mt-5 w-full">
        + {t("В корзину")}
      </Button>
    </div>
  );
}
