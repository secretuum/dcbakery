"use client";

import Link from "next/link";
import Image from "next/image";
import { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import { useCart } from "@/src/contexts/CartContext";
import { LanguageSwitcher } from "@/src/components/layout/LanguageSwitcher";
import { EditableText } from "@/src/components/home/SiteEditMode";
import { useT } from "@/src/i18n/client";

const navItems = [
  { label: "Каталог", href: "/catalog" },
  { label: "О нас", href: "/#about" },
  { label: "Доставка", href: "/#delivery" },
  { label: "Контакты", href: "/contacts" },
];

function CartIcon() {
  return (
    <svg aria-hidden="true" className="size-5" fill="none" stroke="currentColor"
      strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.75" viewBox="0 0 24 24">
      <path d="M6 6h15l-2 8H8L6 6Z" />
      <path d="M6 6 5 3H2" />
      <path d="M9 20a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z" />
      <path d="M18 20a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z" />
    </svg>
  );
}

function ProfileIcon() {
  return (
    <svg aria-hidden="true" className="size-5" fill="none" stroke="currentColor"
      strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.75" viewBox="0 0 24 24">
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21c0-4 3.6-6 8-6s8 2 8 6" />
    </svg>
  );
}

export function Header() {
  const t = useT();
  const { totalItems } = useCart();
  const badgeText = totalItems > 99 ? "99+" : totalItems.toString();
  const [scrolled, setScrolled] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    let ticking = false;
    const onScroll = () => {
      if (!ticking) {
        requestAnimationFrame(() => { setScrolled(window.scrollY > 16); ticking = false; });
        ticking = true;
      }
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={`print-hidden sticky top-0 z-40 border-b backdrop-blur-xl transition-colors duration-200 ${
        scrolled ? "border-black/10 bg-white/90 shadow-sm" : "border-transparent bg-cream/70"
      }`}
    >
      <nav className="mx-auto flex h-16 max-w-7xl items-center gap-3 px-5 lg:h-[72px] lg:px-8">

        {/* Logo */}
        <Link href="/" aria-label="DC Bakery" className="flex items-center gap-2.5 transition hover:opacity-80">
          <Image src="/brand/dc-bakery_icon_1.png" alt="" width={40} height={40} priority className="size-9 object-contain" />
          <span className="flex flex-col leading-none">
            <span className="font-display text-[15px] font-extrabold uppercase tracking-[.13em] text-dark lg:text-[17px]">
              <EditableText field="brand.wordmark" fallback="DC BAKERY" />
            </span>
            <span className="mt-0.5 text-[9px] font-semibold uppercase tracking-[.16em] text-coral">
              <EditableText field="brand.sub" fallback="by del Cappuccino" />
            </span>
          </span>
        </Link>

        {/* Center nav — desktop */}
        <div className="ml-5 hidden items-center gap-0.5 lg:flex">
          {navItems.map((item) => (
            <Link key={item.label} href={item.href}
              className={`rounded-full px-3.5 py-2 text-[13.5px] font-medium transition ${
                pathname === item.href
                  ? "bg-espresso text-white"
                  : "text-ink-soft hover:bg-black/5 hover:text-dark"
              }`}>
              {t(item.label)}
            </Link>
          ))}
        </div>

        {/* Right actions */}
        <div className="ml-auto flex items-center gap-2">
          <LanguageSwitcher />

          <Link href="/profile"
            className="hidden rounded-full bg-espresso px-4 py-2 text-[13.5px] font-semibold text-white transition hover:bg-espresso/90 sm:block">
            {t("Стать партнёром")}
          </Link>

          <Link href="/profile"
            className="flex size-9 items-center justify-center rounded-full border border-black/10 bg-white text-dark transition hover:bg-black/5"
            aria-label={t("Кабинет")}>
            <ProfileIcon />
          </Link>

          <Link href="/cart"
            className="relative flex size-9 items-center justify-center rounded-full border border-black/10 bg-white text-dark transition hover:bg-black/5"
            aria-label={t("Корзина, товаров: ${totalItems}", { totalItems })}>
            <CartIcon />
            {totalItems > 0 && (
              <span className="absolute -right-1.5 -top-1.5 flex min-w-[19px] items-center justify-center rounded-full border-2 border-white bg-coral px-1 py-px text-[10px] font-bold leading-none text-white">
                {badgeText}
              </span>
            )}
          </Link>
        </div>
      </nav>
    </header>
  );
}
