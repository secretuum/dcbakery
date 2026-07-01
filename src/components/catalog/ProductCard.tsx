"use client";

import { Badge } from "@/src/components/ui/Badge";
import { FallbackImage } from "@/src/components/ui/FallbackImage";
import { useCart } from "@/src/contexts/CartContext";
import { useToast } from "@/src/contexts/ToastContext";
import { formatProductPrice } from "@/src/lib/format";
import type { Product } from "@/src/types";

type ProductCardProps = {
  product: Product;
};

export function ProductCard({ product }: ProductCardProps) {
  const { add, remove, updateQty, isReady, items } = useCart();
  const { showToast } = useToast();
  const imageSrc = product.images[0] ?? "/product-placeholder.png";
  const isInStock = isReady && product.stock_qty > 0;
  const priceText = formatProductPrice(product.price);
  const cartItem = items.find((item) => item.product.id === product.id);
  const cartQty = cartItem?.qty ?? 0;
  const inCart = cartQty > 0;
  const step = product.step_qty;

  function handleAddToCart() {
    if (cartQty >= product.stock_qty) {
      showToast("В корзине уже весь доступный остаток", "info");
      return;
    }
    add(product, Math.max(1, product.min_qty ?? product.step_qty ?? 1));
    showToast("Товар добавлен в корзину", "success");
  }

  function handleIncrease() {
    if (cartQty >= product.stock_qty) {
      showToast("В корзине уже весь доступный остаток", "info");
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

  return (
    <article className="overflow-hidden rounded-2xl bg-white shadow-sm">
      <div className="relative aspect-square overflow-hidden">
        <FallbackImage
          src={imageSrc}
          alt={product.name}
          fill
          sizes="(max-width: 640px) 50vw, (max-width: 1280px) 33vw, 25vw"
          className="object-cover"
        />
        {!isInStock && (
          <span className="absolute right-2 top-2">
            <Badge variant="dark">нет</Badge>
          </span>
        )}
      </div>

      <div className="p-3">
        <h3 className="line-clamp-2 text-sm font-semibold text-dark">
          {product.name}
        </h3>

        <div className="mt-2 flex items-center justify-between gap-2">
          <p className="text-base font-bold text-coral">{priceText}</p>

          {inCart ? (
            <div className="flex items-center gap-0.5">
              <button
                onClick={handleDecrease}
                className="flex h-8 w-8 items-center justify-center rounded-full text-xl font-bold text-coral hover:bg-coral/10 active:bg-coral/20"
                aria-label="Уменьшить количество"
              >
                −
              </button>
              <span className="min-w-[1.75rem] text-center text-sm font-bold text-dark">
                {cartQty}
              </span>
              <button
                onClick={handleIncrease}
                disabled={cartQty >= product.stock_qty}
                className="flex h-8 w-8 items-center justify-center rounded-full bg-coral text-white disabled:bg-gray-300"
                aria-label="Увеличить количество"
              >
                +
              </button>
            </div>
          ) : (
            <button
              onClick={handleAddToCart}
              disabled={!isInStock}
              className="flex h-8 w-8 items-center justify-center rounded-full bg-coral text-lg font-bold text-white disabled:bg-gray-300"
              aria-label={`Добавить в корзину: ${product.name}`}
            >
              +
            </button>
          )}
        </div>
      </div>
    </article>
  );
}
