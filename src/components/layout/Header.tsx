"use client";

import Link from "next/link";
import { Button } from "@/src/components/ui/Button";
import { useCart } from "@/src/contexts/CartContext";
import { RETAIL_SITE_URL } from "@/app/constants";

const navItems = [
  { label: "Каталог", href: "/catalog" },
  { label: "Условия", href: "/#terms" },
  { label: "Доставка", href: "/#delivery" },
  { label: "О компании", href: "/#about" },
];

function CartIcon() {
  return (
    <svg
      aria-hidden="true"
      className="size-5"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2"
      viewBox="0 0 24 24"
    >
      <path d="M6 6h15l-2 8H8L6 6Z" />
      <path d="M6 6 5 3H2" />
      <path d="M9 20a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z" />
      <path d="M18 20a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z" />
    </svg>
  );
}

function ProfileIcon() {
  return (
    <svg
      aria-hidden="true"
      className="size-5"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2"
      viewBox="0 0 24 24"
    >
      <path d="M20 21a8 8 0 0 0-16 0" />
      <path d="M12 13a5 5 0 1 0 0-10 5 5 0 0 0 0 10Z" />
    </svg>
  );
}

export function Header() {
  const { totalItems } = useCart();
  const badgeText = totalItems > 99 ? "99+" : totalItems.toString();

  return (
    <header className="print-hidden sticky top-0 z-30 border-b border-black/10 bg-cream/90 backdrop-blur-xl">
      <nav className="mx-auto flex max-w-7xl flex-col gap-4 px-5 py-4 lg:flex-row lg:items-center lg:justify-between lg:px-8">
        <Link href="/" className="flex items-center gap-3" aria-label="DC Bakery">
          <span className="flex size-11 items-center justify-center rounded-card bg-coral text-sm font-black text-white shadow-[0_14px_30px_rgba(244,123,111,0.26)]">
            DC
          </span>
          <span className="text-xl font-black tracking-tight text-dark">DC Bakery</span>
        </Link>

        <div className="flex flex-wrap items-center gap-2 text-sm font-bold text-muted">
          {navItems.map((item) => (
            <Link
              key={item.label}
              href={item.href}
              className="rounded-btn px-4 py-2 transition hover:bg-white hover:text-dark hover:shadow-sm"
            >
              {item.label}
            </Link>
          ))}

          <Button
            href={RETAIL_SITE_URL}
            target="_blank"
            rel="noopener noreferrer"
            variant="ghost"
            className="min-h-10 px-4 py-2"
          >
            Заказать в розницу →
          </Button>

          <Link
            href="/profile"
            className="inline-flex min-h-10 items-center justify-center gap-2 rounded-btn bg-white px-4 py-2 text-dark shadow-sm transition hover:shadow-md"
          >
            <ProfileIcon />
            <span className="font-bold">Профиль</span>
          </Link>

          <Link
            href="/cart"
            className="relative inline-flex min-h-10 items-center justify-center gap-2 rounded-btn bg-white px-4 py-2 text-dark shadow-sm transition hover:shadow-md"
            aria-label={`Корзина, товаров: ${totalItems}`}
          >
            <CartIcon />
            <span className="font-bold">Корзина</span>
            <span className="absolute -right-2 -top-2 min-w-6 rounded-badge bg-burgundy px-2 py-1 text-center text-xs font-black leading-none text-white">
              {badgeText}
            </span>
          </Link>
        </div>
      </nav>
    </header>
  );
}
