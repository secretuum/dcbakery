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
    <main className="min-h-screen bg-cream text-dark lg:grid lg:grid-cols-[280px_1fr]">
      <aside className="border-b border-black/10 bg-white/90 px-5 py-4 backdrop-blur lg:sticky lg:top-0 lg:h-screen lg:border-b-0 lg:border-r lg:px-6 lg:py-6">
        <div className="flex items-center justify-between gap-4 lg:block">
          <Link href="/admin/orders" className="flex items-center gap-3">
            <span className="flex size-11 items-center justify-center rounded-card bg-coral text-sm font-black text-white shadow-[0_14px_30px_rgba(244,123,111,0.26)]">
              DC
            </span>
            <span>
              <span className="block text-xl font-black tracking-tight">DC Bakery</span>
              <span className="block text-xs font-black uppercase text-muted">admin</span>
            </span>
          </Link>
        </div>

        <nav className="mt-6 flex gap-2 overflow-x-auto lg:flex-col lg:overflow-visible">
          {adminNavItems.map((item) => {
            const isActive = pathname === item.href;

            return (
              <Link
                key={item.href}
                href={item.href}
                className={[
                  "shrink-0 rounded-btn px-4 py-3 text-sm font-black transition",
                  isActive
                    ? "bg-coral text-dark shadow-[0_14px_30px_rgba(244,123,111,0.22)]"
                    : "text-muted hover:bg-coral-light hover:text-dark",
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
