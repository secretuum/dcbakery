"use client";

import { LocaleLink as Link } from "@/src/i18n/LocaleLink";
import { usePathname } from "next/navigation";
import { useCart } from "@/src/contexts/CartContext";
import { useT } from "@/src/i18n/client";
import { stripLocale } from "@/src/i18n/routing";

type Item = { href: string; label: string; icon: React.ReactNode };

const ICONS = {
  home: (
    <path d="M4 11 12 4l8 7M6 10v9h12v-9" />
  ),
  catalog: (
    <path d="M4 5h7v7H4zM13 5h7v7h-7zM4 14h7v5H4zM13 14h7v5h-7z" />
  ),
  cart: (
    <>
      <path d="M6 6h15l-2 8H8L6 6Z" />
      <path d="M6 6 5 3H2" />
      <circle cx="9" cy="19" r="1" />
      <circle cx="18" cy="19" r="1" />
    </>
  ),
  profile: (
    <>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21c0-4 3.6-6 8-6s8 2 8 6" />
    </>
  ),
};

export function BottomNav() {
  const t = useT();
  const pathname = stripLocale(usePathname()).path;
  const { totalItems } = useCart();
  const badgeText = totalItems > 99 ? "99+" : totalItems.toString();

  const items: Item[] = [
    { href: "/", label: t("Главная"), icon: ICONS.home },
    { href: "/catalog", label: t("Каталог"), icon: ICONS.catalog },
    { href: "/cart", label: t("Корзина"), icon: ICONS.cart },
    { href: "/profile", label: t("Кабинет"), icon: ICONS.profile },
  ];

  return (
    <nav
      className="print-hidden fixed inset-x-0 bottom-0 z-40 grid grid-cols-4 border-t border-black/10 bg-white/90 backdrop-blur-xl lg:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      {items.map((item) => {
        const active =
          item.href === "/"
            ? pathname === "/"
            : pathname === item.href || pathname.startsWith(`${item.href}/`);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={`relative flex h-[68px] flex-col items-center justify-center gap-1 text-[10.5px] font-semibold transition-colors ${
              active ? "text-coral" : "text-muted hover:text-dark"
            }`}
          >
            <span className="relative">
              <svg className="size-[22px]" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
                {item.icon}
              </svg>
              {item.href === "/cart" && totalItems > 0 ? (
                <span className="absolute -right-2.5 -top-1.5 flex min-w-[17px] items-center justify-center rounded-full border-2 border-white bg-coral px-1 text-[9px] font-bold leading-none text-white">
                  {badgeText}
                </span>
              ) : null}
            </span>
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
