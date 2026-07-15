"use client";

import Link from "next/link";
import { CartItem } from "@/src/components/cart/CartItem";
import { CartSummary } from "@/src/components/cart/CartSummary";
import { Button } from "@/src/components/ui/Button";
import { useCart } from "@/src/contexts/CartContext";

export default function CartPage() {
  const { clear, items } = useCart();

  if (items.length === 0) {
    return (
      <main className="min-h-screen bg-cream px-5 py-12 text-dark lg:px-8">
        <section className="mx-auto max-w-3xl rounded-card border border-black/10 bg-white p-8 text-center">
          <p className="text-xs font-semibold uppercase tracking-[.15em] text-muted">Корзина</p>
          <h1 className="mt-3 font-display text-3xl font-semibold tracking-tight sm:text-4xl">
            В корзине пока пусто
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-base leading-7 text-muted">
            Выберите товары в каталоге, а затем соберите B2B-заявку от минимальной суммы заказа.
          </p>
          <Link
            href="/catalog"
            className="mt-6 inline-flex min-h-12 items-center justify-center rounded-btn border border-coral bg-coral px-5 py-3 text-sm font-bold text-white transition hover:bg-coral-hover"
          >
            Перейти в каталог
          </Link>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-cream px-5 pb-28 pt-10 text-dark lg:px-8 lg:pb-16 lg:pt-14">
      <section className="mx-auto max-w-7xl">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[.15em] text-muted">Корзина DC Bakery</p>
            <h1 className="mt-3 font-display text-3xl font-semibold leading-tight tracking-tight sm:text-4xl lg:text-5xl">
              Ваша B2B-заявка
            </h1>
            <p className="mt-4 max-w-2xl text-base leading-7 text-muted">
              Проверьте количество, фасовку и сумму. Менеджер подтвердит наличие, доставку и товары
              с ценой по запросу.
            </p>
          </div>

          <Button variant="ghost" onClick={clear} className="self-start border border-black/15 bg-white">
            Очистить корзину
          </Button>
        </div>

        <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_360px] lg:items-start">
          <div className="space-y-4">
            {items.map((item) => (
              <CartItem key={item.product.id} item={item} />
            ))}
          </div>

          <CartSummary />
        </div>
      </section>
    </main>
  );
}
