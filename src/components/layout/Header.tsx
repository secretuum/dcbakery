"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import { useCart } from "@/src/contexts/CartContext";

const navItems = [
  { label: "Каталог", href: "/catalog" },
  { label: "О нас", href: "/#about" },
  { label: "Доставка", href: "/#delivery" },
  { label: "Контакты", href: "/#about" },
];

function CartIcon() {
  return (
    <svg aria-hidden="true" className="size-4" fill="none" stroke="currentColor"
      strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.75" viewBox="0 0 24 24">
      <path d="M6 6h15l-2 8H8L6 6Z" />
      <path d="M6 6 5 3H2" />
      <path d="M9 20a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z" />
      <path d="M18 20a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z" />
    </svg>
  );
}

export function Header() {
  const { totalItems } = useCart();
  const badgeText = totalItems > 99 ? "99+" : totalItems.toString();
  const [scrolled, setScrolled] = useState(false);
  const pathname = usePathname();
  const isCatalog = pathname === "/catalog" || pathname.startsWith("/catalog/");

  useEffect(() => {
    let ticking = false;
    const onScroll = () => {
      if (!ticking) {
        requestAnimationFrame(() => { setScrolled(window.scrollY > 20); ticking = false; });
        ticking = true;
      }
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header className={`print-hidden sticky top-0 z-30 border-b border-black/10 bg-white/95 backdrop-blur-sm transition-shadow duration-200 ${scrolled ? "shadow-sm" : ""}`}>
      <nav className="mx-auto flex max-w-7xl items-center gap-3 px-5 py-3 lg:px-8">

        {/* Logo */}
        <Link href="/" aria-label="DC Bakery"
          className="font-display text-[15px] font-black uppercase tracking-[.12em] text-dark transition hover:opacity-60">
          DC BAKERY
        </Link>

        {/* Center nav — desktop, hidden on catalog */}
        {!isCatalog && (
          <div className="ml-4 hidden items-center gap-0.5 lg:flex">
            {navItems.map((item) => (
              <Link key={item.label} href={item.href}
                className={`rounded px-3 py-1.5 text-sm font-medium transition ${
                  pathname === item.href
                    ? "bg-dark text-white"
                    : "text-muted hover:bg-black/5 hover:text-dark"
                }`}>
                {item.label}
              </Link>
            ))}
          </div>
        )}

        {/* Right actions */}
        <div className="ml-auto flex items-center gap-2">
          {/* Стать партнёром → /profile */}
          <Link href="/profile"
            className="hidden rounded border border-dark bg-dark px-3.5 py-1.5 text-sm font-semibold text-white transition hover:bg-dark/80 sm:block">
            Стать партнёром
          </Link>

          {/* Кабинет */}
          <Link href="/profile"
            className="rounded border border-black/15 px-3 py-1.5 text-sm font-medium text-dark transition hover:bg-black/5">
            Кабинет
          </Link>

          {/* Cart */}
          <Link href="/cart"
            className="relative flex size-9 items-center justify-center rounded border border-black/15 text-dark transition hover:bg-black/5"
            aria-label={`Корзина, товаров: ${totalItems}`}>
            <CartIcon />
            {totalItems > 0 && (
              <span className="absolute -right-1 -top-1 flex min-w-4 items-center justify-center rounded-full bg-coral px-0.5 py-px text-[9px] font-bold leading-none text-white">
                {badgeText}
              </span>
            )}
          </Link>
        </div>
      </nav>
    </header>
  );
}
