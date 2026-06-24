"use client";

import Link from "next/link";
import { Badge } from "@/src/components/ui/Badge";
import { Button } from "@/src/components/ui/Button";
import { FallbackImage } from "@/src/components/ui/FallbackImage";
import { useCart } from "@/src/contexts/CartContext";
import { useToast } from "@/src/contexts/ToastContext";
import { formatProductPrice } from "@/src/lib/format";
import type { Product } from "@/src/types";

type ProductCardProps = {
  product: Product;
};

export function ProductCard({ product }: ProductCardProps) {
  const { add, isReady, items } = useCart();
  const { showToast } = useToast();
  const imageSrc = product.images[0] ?? "/product-placeholder.png";
  const isInStock = isReady && product.stock_qty > 0;
  const priceText = formatProductPrice(product.price);

  function handleAddToCart() {
    const cartQty = items.find((item) => item.product.id === product.id)?.qty ?? 0;

    if (cartQty >= product.stock_qty) {
      showToast("В корзине уже весь доступный остаток", "info");
      return;
    }

    add(product);
    showToast("Товар добавлен в корзину", "success");
  }

  return (
    <article className="overflow-hidden rounded-card bg-white shadow-[0_16px_46px_rgba(120,51,38,0.10)] transition duration-300 hover:scale-[1.02] hover:shadow-[0_24px_70px_rgba(120,51,38,0.16)]">
      <Link href={`/product/${product.slug}`} className="block">
        <div className="relative aspect-square overflow-hidden rounded-t-card bg-coral-light">
          <FallbackImage
            src={imageSrc}
            alt={product.name}
            fill
            sizes="(max-width: 640px) 50vw, (max-width: 1280px) 33vw, 25vw"
            className="object-cover transition duration-300 hover:scale-105"
          />
        </div>
      </Link>

      <div className="p-4 sm:p-5">
        <div className="flex items-start justify-between gap-3">
          <Badge variant="burgundy">{product.category?.name ?? "Каталог"}</Badge>
          <Badge variant={isInStock ? "neutral" : "dark"}>{isInStock ? "в наличии" : "нет"}</Badge>
        </div>

        <Link href={`/product/${product.slug}`} className="mt-4 block">
          <h3 className="line-clamp-2 min-h-14 text-xl font-black leading-7 tracking-tight text-dark">
            {product.name}
          </h3>
        </Link>

        <p className="mt-3 line-clamp-2 min-h-12 text-sm font-semibold leading-6 text-muted">
          {product.description}
        </p>

        <div className="mt-5 flex items-end justify-between gap-3">
          <div>
            <p className="text-xs font-black uppercase text-muted">B2B цена</p>
            <p className="mt-1 text-2xl font-black text-coral">{priceText}</p>
          </div>
          <Badge variant="coral">за {product.unit}</Badge>
        </div>

        <div className="mt-4 flex items-center justify-between rounded-btn bg-coral-light px-4 py-3 text-sm font-bold text-muted">
          <span>Фасовка</span>
          <span className="text-right text-dark">{product.weightLabel ?? "уточняется"}</span>
        </div>

        <div className="mt-4 flex items-center justify-between rounded-btn bg-cream px-4 py-3 text-sm font-bold text-muted">
          <span>Остаток</span>
          <span className="text-dark">
            {product.stock_qty} {product.unit}
          </span>
        </div>

        <Button
          onClick={handleAddToCart}
          disabled={!isInStock}
          className="mt-4 w-full"
          aria-label={`Добавить в корзину: ${product.name}`}
        >
          + В корзину
        </Button>
      </div>
    </article>
  );
}
