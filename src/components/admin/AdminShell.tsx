"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { AdminLogoutButton } from "@/src/components/admin/AdminLogoutButton";

const adminNavItems = [
  { href: "/admin", label: "Дашборд" },
  { href: "/admin/orders", label: "Заказы" },
  { href: "/admin/documents", label: "Накладные и счета" },
  { href: "/admin/clients", label: "Наши клиенты" },
  { href: "/admin/products", label: "Товары" },
  { href: "/admin/stop-list", label: "Стоп-лист" },
  { href: "/admin/comments", label: "Комментарии" },
  { href: "/admin/settings", label: "Настройки" },
];

export function AdminShell({
  children,
  role,
}: {
  children: ReactNode;
  role?: "admin" | "manager" | null;
}) {
  const pathname = usePathname();

  if (pathname === "/admin/login") {
    return <>{children}</>;
  }

  const isManager = role === "manager";

  return (
    <main className="min-h-screen bg-cream text-dark lg:grid lg:grid-cols-[240px_1fr]">
      <aside className="border-b border-white/10 bg-dark px-5 py-4 lg:sticky lg:top-0 lg:h-screen lg:border-b-0 lg:border-r lg:border-r-white/10 lg:px-6 lg:py-6">
        <div className="flex items-center justify-between gap-4 lg:block">
          <Link href="/admin" className="flex items-center gap-3">
            <span className="flex size-9 items-center justify-center rounded bg-coral font-display text-xs font-bold text-white">
              DC
            </span>
            <span>
              <span className="block font-display text-base font-bold uppercase tracking-[.08em] text-white">DC Bakery</span>
              <span className="block text-xs font-semibold uppercase tracking-[.12em] text-white/40">admin</span>
              {isManager ? (
                <span className="mt-1 inline-block rounded bg-amber-400/20 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-300">
                  менеджер · только просмотр
                </span>
              ) : null}
            </span>
          </Link>
          {/* Выход из админки на публичный сайт — в новой вкладке, чтобы админка осталась
              открытой. Логотип намеренно ведёт на дашборд, а не на сайт. */}
          <a
            href="/"
            target="_blank"
            rel="noopener noreferrer"
            title="Открыть публичный сайт в новой вкладке"
            className="inline-flex shrink-0 items-center gap-1 rounded px-2.5 py-1.5 text-xs font-bold text-white/70 transition hover:bg-white/10 hover:text-white lg:mt-4"
          >
            На сайт ↗
          </a>
        </div>

        <nav className="mt-8 flex gap-1 overflow-x-auto lg:flex-col lg:overflow-visible">
          {adminNavItems.map((item) => {
            // Дашборд (/admin) — точное совпадение: иначе pathname.startsWith("/admin")
            // подсвечивал бы его на всех страницах админки. Остальные — по префиксу
            // (чтобы /admin/orders/123 подсвечивал «Заказы»).
            const isActive =
              item.href === "/admin" ? pathname === "/admin" : pathname.startsWith(item.href);

            return (
              <Link
                key={item.href}
                href={item.href}
                className={[
                  "shrink-0 rounded px-3 py-2.5 text-sm font-bold transition",
                  isActive
                    ? "bg-coral text-white"
                    : "text-white/85 hover:bg-white/10 hover:text-white",
                ].join(" ")}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="mt-6 lg:absolute lg:bottom-6 lg:left-6 lg:right-6">
          <AdminLogoutButton />
        </div>
      </aside>

      <section className="min-w-0 px-5 py-8 lg:px-8 lg:py-10">{children}</section>
    </main>
  );
}
