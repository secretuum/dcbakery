import type { Metadata } from "next";
import Link from "next/link";
import { fetchCategories, fetchProducts } from "@/src/lib/catalog";
import { HomeCatalogTabs } from "@/src/components/home/HomeCatalogTabs";

export const metadata: Metadata = {
  title: "DC Bakery — B2B поставщик продуктов питания",
  description:
    "Поставки десертов, полуфабрикатов и мяса для кофеен, ресторанов, магазинов и отелей. Оптовые B2B-цены, халал сертификаты, натуральные ингредиенты.",
};

const stats = [
  { value: "50+", label: "кофеен и ресторанов\nработают с нами" },
  { value: "98%", label: "заказов доставлено\nвовремя" },
  { value: "Халал", label: "сертификаты\nна всё мясо" },
  { value: "100%", label: "натуральные\nингредиенты" },
];

const contactInfo = [
  { label: "Телефон", value: "+7 (705) 886-50-14" },
  { label: "WhatsApp", value: "+7 (705) 886-50-14" },
  { label: "Адрес", value: "Казахстан" },
  { label: "Режим работы", value: "Пн–Пт 9:00–19:00" },
];

export default async function Home() {
  const [categories, allProducts] = await Promise.all([
    fetchCategories(),
    fetchProducts(),
  ]);

  return (
    <main className="text-dark">

      {/* ─── Hero ─── */}
      <section className="border-b border-black/10 bg-white px-5 py-12 lg:px-8 lg:py-16">
        <div className="mx-auto max-w-7xl">
          <div className="grid items-end gap-10 lg:grid-cols-[1fr_auto]">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[.15em] text-muted">
                B2B поставщик · Казахстан
              </p>
              <h1 className="mt-4 font-display text-4xl font-semibold leading-tight tracking-tight sm:text-5xl lg:text-[3.25rem]">
                Надёжные поставки<br />для вашего бизнеса
              </h1>
              <p className="mt-5 max-w-xl text-base leading-7 text-muted">
                Десерты, полуфабрикаты и мясо для кофеен, ресторанов, отелей и магазинов.
                Оптовые цены, живые остатки, история заказов — всё в одном кабинете.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Link href="/catalog"
                  className="rounded border border-dark bg-dark px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-dark/80">
                  Открыть каталог
                </Link>
                <Link href="/profile"
                  className="rounded border border-black/20 px-5 py-2.5 text-sm font-semibold text-dark transition hover:bg-black/5">
                  Стать партнёром
                </Link>
              </div>
            </div>

            {/* Stat grid — desktop */}
            <div className="hidden grid-cols-2 gap-px border border-black/10 bg-black/10 lg:grid">
              {stats.map((stat) => (
                <div key={stat.value} className="bg-white px-8 py-6">
                  <p className="font-data text-3xl font-semibold text-dark">{stat.value}</p>
                  <p className="mt-2 text-xs leading-relaxed text-muted" style={{ whiteSpace: "pre-line" }}>
                    {stat.label}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* Stats — mobile */}
          <div className="mt-10 grid grid-cols-2 gap-px border border-black/10 bg-black/10 sm:grid-cols-4 lg:hidden">
            {stats.map((stat) => (
              <div key={stat.value} className="bg-white px-4 py-4">
                <p className="font-data text-2xl font-semibold text-dark">{stat.value}</p>
                <p className="mt-1.5 text-xs leading-relaxed text-muted" style={{ whiteSpace: "pre-line" }}>
                  {stat.label}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Catalog ─── */}
      <HomeCatalogTabs categories={categories} products={allProducts} />

      {/* ─── About ─── */}
      <section id="about" className="border-t border-black/10 bg-white px-5 py-14 lg:px-8 lg:py-20">
        <div className="mx-auto max-w-7xl">
          <div className="grid gap-8 lg:grid-cols-[1fr_340px] lg:items-start">

            {/* About text */}
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[.12em] text-muted">О компании</p>
              <h2 className="mt-3 font-display text-2xl font-semibold tracking-tight lg:text-3xl">
                DC Bakery — B2B поставщик еды в Казахстане
              </h2>
              <p className="mt-4 max-w-2xl text-sm leading-7 text-muted">
                Мы специализируемся на поставках продуктов питания для B2B-сегмента:
                кофеен, ресторанов, гостиниц и магазинов. Работаем с 50+ партнёрами
                по всему Казахстану.
              </p>
              <ul className="mt-6 space-y-2">
                {[
                  "Халал сертификаты на всё мясо и полуфабрикаты",
                  "Натуральные ингредиенты без консервантов",
                  "Доставка 98% заказов вовремя",
                  "Личный менеджер для каждого партнёра",
                ].map((item) => (
                  <li key={item} className="flex items-start gap-2.5 text-sm text-dark">
                    <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-coral" />
                    {item}
                  </li>
                ))}
              </ul>
              <div className="mt-8">
                <Link href="/profile"
                  className="rounded border border-dark bg-dark px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-dark/80">
                  Стать партнёром
                </Link>
              </div>
            </div>

            {/* Contacts */}
            <div id="delivery" className="rounded border border-black/10 bg-cream p-5">
              <p className="font-display text-[11px] font-semibold uppercase tracking-[.07em] text-dark">
                Контакты
              </p>
              <div className="mt-3 space-y-0">
                {contactInfo.map((item) => (
                  <div key={item.label}
                    className="flex items-baseline justify-between border-b border-black/5 py-2.5 text-sm last:border-0">
                    <span className="text-muted">{item.label}</span>
                    <span className="font-data font-medium text-dark">{item.value}</span>
                  </div>
                ))}
              </div>
              <div className="mt-4 border-t border-black/5 pt-4">
                <p className="text-[10px] font-semibold uppercase tracking-[.08em] text-muted">
                  График поставок
                </p>
                <p className="mt-2 text-sm text-dark">
                  Вторник · Четверг · Суббота
                </p>
                <p className="mt-1 text-xs text-muted">Приём заказов до 18:00 накануне</p>
              </div>
            </div>

          </div>
        </div>
      </section>

    </main>
  );
}
