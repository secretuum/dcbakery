"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { AdminLogoutButton } from "@/src/components/admin/AdminLogoutButton";

const adminNavItems = [
  { href: "/admin/orders", label: "Заказы" },
  { href: "/admin/clients", label: "Клиенты" },
  { href: "/admin/products", label: "Товары" },
  { href: "/admin/stop-list", label: "Стоп-лист" },
  { href: "/admin/settings", label: "Настройки" },
];

export function AdminShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  if (pathname === "/admin/login") {
    return <>{children}</>;
  }

  return (
    <main className="min-h-screen bg-cream text-dark lg:grid lg:grid-cols-[240px_1fr]">
      <aside className="border-b border-white/10 bg-dark px-5 py-4 lg:sticky lg:top-0 lg:h-screen lg:border-b-0 lg:border-r lg:border-r-white/10 lg:px-6 lg:py-6">
        <div className="flex items-center justify-between gap-4 lg:block">
          <Link href="/admin/orders" className="flex items-center gap-3">
            <span className="flex size-9 items-center justify-center rounded bg-coral font-display text-xs font-black text-white">
              DC
            </span>
            <span>
              <span className="block font-display text-base font-black uppercase tracking-[.08em] text-white">DC Bakery</span>
              <span className="block text-xs font-semibold uppercase tracking-[.12em] text-white/40">admin</span>
            </span>
          </Link>
        </div>

        <nav className="mt-8 flex gap-1 overflow-x-auto lg:flex-col lg:overflow-visible">
          {adminNavItems.map((item) => {
            const isActive = pathname.startsWith(item.href);

            return (
              <Link
                key={item.href}
                href={item.href}
                className={[
                  "shrink-0 rounded px-3 py-2.5 text-sm font-semibold transition",
                  isActive
                    ? "bg-coral text-white"
                    : "text-white/60 hover:bg-white/8 hover:text-white",
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
