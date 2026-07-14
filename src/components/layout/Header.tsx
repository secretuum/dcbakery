"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import { useCart } from "@/src/contexts/CartContext";

const navItems = [
  { label: "Каталог", href: "/catalog" },
  { label: "О компании", href: "/#about" },
  { label: "Доставка", href: "/#delivery" },
  { label: "Условия", href: "/#terms" },
  { label: "Контакты", href: "/#about" },
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
      strokeWidth="1.75"
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
      strokeWidth="1.75"
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
  const [scrolled, setScrolled] = useState(false);
  const pathname = usePathname();
  const isCatalog = pathname === "/catalog" || pathname.startsWith("/catalog/");

  useEffect(() => {
    let ticking = false;
    const onScroll = () => {
      if (!ticking) {
        requestAnimationFrame(() => {
          setScrolled(window.scrollY > 40);
          ticking = false;
        });
        ticking = true;
      }
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={`print-hidden sticky top-0 z-30 border-b border-fudo-border bg-white/95 backdrop-blur-xl transition-shadow duration-200 ${
        scrolled ? "shadow-[0_1px_12px_rgba(0,0,0,0.06)]" : ""
      }`}
    >
      <nav className="mx-auto flex max-w-7xl items-center justify-between gap-6 px-5 py-4 lg:px-8">
        {/* Logo */}
        <Link
          href="/"
          className="text-lg font-black uppercase tracking-[0.12em] text-fudo-dark transition hover:opacity-75"
          aria-label="DC Bakery"
        >
          DC Bakery
        </Link>

        {/* Center nav — desktop only */}
        {!isCatalog && (
          <div className="hidden items-center gap-0.5 lg:flex">
            {navItems.map((item) => (
              <Link
                key={item.label}
                href={item.href}
                className="rounded-lg px-3.5 py-2 text-sm font-medium text-fudo-muted transition hover:text-fudo-dark"
              >
                {item.label}
              </Link>
            ))}
          </div>
        )}

        {/* Right actions */}
        <div className="flex items-center gap-3">
          <Link
            href="/profile"
            className="flex items-center gap-2 rounded-xl bg-fudo-accent px-3 py-2 text-sm font-black text-white transition hover:opacity-90 sm:px-4"
            aria-label="Профиль"
          >
            <ProfileIcon />
            <span className="hidden sm:inline">Профиль</span>
          </Link>

          <Link
            href="/#terms"
            className="hidden rounded-xl border border-fudo-accent px-5 py-2.5 text-sm font-semibold text-fudo-accent transition hover:bg-fudo-accent-light lg:flex"
          >
            Стать партнёром
          </Link>

          <Link
            href="/cart"
            className="relative flex size-10 items-center justify-center rounded-xl border border-fudo-border text-fudo-dark transition hover:border-fudo-accent hover:text-fudo-accent"
            aria-label={`Корзина, товаров: ${totalItems}`}
          >
            <CartIcon />
            {totalItems > 0 && (
              <span className="absolute -right-1.5 -top-1.5 flex min-w-5 items-center justify-center rounded-full bg-fudo-accent px-1 py-0.5 text-[10px] font-bold leading-none text-white">
                {badgeText}
              </span>
            )}
          </Link>
        </div>
      </nav>
    </header>
  );
}
