import type { Metadata } from "next";
import Link from "next/link";
import { fetchCategories, fetchProducts } from "@/src/lib/catalog";
import { HomeCatalogTabs } from "@/src/components/home/HomeCatalogTabs";

export const metadata: Metadata = {
  title: "DC Bakery — надёжный B2B-поставщик",
  description:
    "B2B-поставщик десертов, полуфабрикатов и мяса для кофеен, ресторанов, магазинов и отелей. Оптовые цены, живые остатки, история заказов.",
};

const stats = [
  { value: "100+", label: "наименований\nв каталоге" },
  { value: "500+", label: "партнёров\nв Казахстане" },
  { value: "98%", label: "заказов\nдоставлено в срок" },
];

const orderSteps = [
  "Выберите товары в каталоге",
  "Оформите заявку онлайн",
  "Менеджер подтвердит заказ",
  "Доставка или самовывоз",
];

const advantages = [
  {
    title: "Контроль качества",
    desc: "Каждая партия проходит проверку перед отгрузкой. Работаем только с проверенным сырьём.",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
        <path d="m9 12 2 2 4-4" />
      </svg>
    ),
  },
  {
    title: "Своевременная доставка",
    desc: "Слот доставки согласуется с менеджером под ваш график. Работает собственная логистика.",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M5 17H3a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11a2 2 0 0 1 2 2v3" />
        <rect width="7" height="7" x="14" y="10" rx="1" />
        <path d="M5 17a2 2 0 1 0 4 0 2 2 0 0 0-4 0Z" />
        <path d="M17 17a2 2 0 1 0 4 0 2 2 0 0 0-4 0Z" />
        <path d="M16 10h4l1 4" />
      </svg>
    ),
  },
  {
    title: "Удобный формат",
    desc: "Оформляйте заявки 24/7. История заказов и повтор закупок — в пару кликов.",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <rect width="7" height="7" x="3" y="3" rx="1" />
        <rect width="7" height="7" x="14" y="3" rx="1" />
        <rect width="7" height="7" x="3" y="14" rx="1" />
        <rect width="7" height="7" x="14" y="14" rx="1" />
      </svg>
    ),
  },
  {
    title: "Выгодное сотрудничество",
    desc: "Прозрачные оптовые цены без скрытых наценок. Минимальный заказ от 15 000 ₸.",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
      </svg>
    ),
  },
];

const contactInfo = [
  { label: "Телефон", value: "+7 (705) 886-50-14" },
  { label: "WhatsApp", value: "+7 (705) 886-50-14" },
  { label: "Адрес", value: "Казахстан, уточняется" },
  { label: "Режим работы", value: "Ежедневно 9:00–19:00" },
];

export default async function Home() {
  const [categories, allProducts] = await Promise.all([
    fetchCategories(),
    fetchProducts(),
  ]);

  return (
    <main className="text-fudo-dark">

      {/* ─── Hero ─── */}
      <section className="hero-gradient relative overflow-hidden">
        {/* Sunray decoration */}
        <svg
          className="pointer-events-none absolute inset-0 h-full w-full"
          viewBox="0 0 1000 520"
          preserveAspectRatio="xMidYMid slice"
          aria-hidden="true"
        >
          <path d="M0,260 L1100,-120 L1100,-30 Z"   fill="#E8963C" fillOpacity="0.045"/>
          <path d="M0,260 L1100,-30  L1100,80 Z"    fill="#E8963C" fillOpacity="0.028"/>
          <path d="M0,260 L1100,80   L1100,185 Z"   fill="#E8963C" fillOpacity="0.045"/>
          <path d="M0,260 L1100,185  L1100,295 Z"   fill="#E8963C" fillOpacity="0.028"/>
          <path d="M0,260 L1100,295  L1100,405 Z"   fill="#E8963C" fillOpacity="0.045"/>
          <path d="M0,260 L1100,405  L1100,510 Z"   fill="#E8963C" fillOpacity="0.028"/>
          <path d="M0,260 L1100,510  L1100,640 Z"   fill="#E8963C" fillOpacity="0.045"/>
        </svg>

        <div className="relative z-10 mx-auto max-w-7xl px-5 pb-16 pt-14 lg:px-8 lg:pb-24 lg:pt-20">
          <div className="grid items-center gap-14 lg:grid-cols-2">

            {/* Left: headline + CTA */}
            <div>
              <span className="text-xs font-semibold uppercase tracking-[0.15em] text-fudo-muted">
                B2B поставщик продуктов питания
              </span>
              <h1 className="mt-5 text-5xl font-black leading-[1.06] tracking-tight text-fudo-dark lg:text-[3.5rem]">
                Надёжные<br />
                полуфабрикаты<br />
                для вашего бизнеса
              </h1>
              <p className="mt-6 max-w-md text-base leading-7 text-fudo-muted">
                Поставки для кофеен, ресторанов, отелей и магазинов. Оптовые B2B-цены,
                живые остатки и история заказов — всё в одном кабинете.
              </p>
              <div className="mt-8 flex flex-wrap gap-4">
                <Link
                  href="/catalog"
                  className="inline-flex items-center justify-center rounded-xl bg-fudo-accent px-8 py-4 text-sm font-semibold text-white transition hover:opacity-90"
                >
                  Смотреть каталог
                </Link>
                <Link
                  href="#terms"
                  className="inline-flex items-center justify-center rounded-xl border border-fudo-accent px-8 py-4 text-sm font-semibold text-fudo-accent transition hover:bg-fudo-accent-light"
                >
                  Стать партнёром
                </Link>
              </div>
            </div>

            {/* Right: stats — desktop */}
            <div className="hidden divide-x divide-fudo-border lg:flex">
              {stats.map((stat) => (
                <div key={stat.value} className="flex-1 px-8 first:pl-0 last:pr-0">
                  <p className="text-6xl font-black tracking-tight text-fudo-dark">{stat.value}</p>
                  <p className="mt-3 text-sm leading-relaxed text-fudo-muted" style={{ whiteSpace: "pre-line" }}>
                    {stat.label}
                  </p>
                </div>
              ))}
            </div>

            {/* Stats — mobile */}
            <div className="grid grid-cols-3 divide-x divide-fudo-border lg:hidden">
              {stats.map((stat) => (
                <div key={stat.value} className="px-4 first:pl-0 last:pr-0">
                  <p className="text-3xl font-black tracking-tight text-fudo-dark">{stat.value}</p>
                  <p className="mt-1.5 text-xs leading-relaxed text-fudo-muted" style={{ whiteSpace: "pre-line" }}>
                    {stat.label}
                  </p>
                </div>
              ))}
            </div>

          </div>
        </div>
      </section>

      {/* ─── Catalog with category tabs ─── */}
      <HomeCatalogTabs categories={categories} products={allProducts} />

      {/* ─── How it works ─── */}
      <section id="terms" className="border-t border-fudo-border bg-white px-5 py-16 lg:px-8 lg:py-24">
        <div className="mx-auto max-w-7xl">
          <div className="mb-12">
            <p className="text-xs font-medium uppercase tracking-[0.15em] text-fudo-muted">
              Как работает заказ
            </p>
            <h2 className="mt-4 text-3xl font-black tracking-tight text-fudo-dark lg:text-4xl">
              Быстро, понятно,<br className="hidden sm:block" />
              с подтверждением менеджера
            </h2>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {orderSteps.map((step, i) => (
              <div key={step} className="rounded-2xl border border-fudo-border bg-white p-6">
                <p className="text-4xl font-black tracking-tight text-fudo-accent">0{i + 1}</p>
                <p className="mt-6 text-sm font-semibold leading-relaxed text-fudo-dark">{step}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Advantages ─── */}
      <section id="delivery" className="bg-fudo-beige px-5 py-16 lg:px-8 lg:py-24">
        <div className="mx-auto max-w-7xl">
          <div className="mb-12">
            <p className="text-xs font-medium uppercase tracking-[0.15em] text-fudo-muted">
              Почему выбирают нас
            </p>
            <h2 className="mt-4 text-3xl font-black tracking-tight text-fudo-dark lg:text-4xl">
              Надёжный партнёр<br className="hidden sm:block" />
              для вашего бизнеса
            </h2>
          </div>
          <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
            {advantages.map((adv) => (
              <div key={adv.title}>
                <div className="flex size-12 items-center justify-center rounded-full border border-fudo-border bg-white text-fudo-dark">
                  {adv.icon}
                </div>
                <h3 className="mt-5 text-base font-bold text-fudo-dark">{adv.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-fudo-muted">{adv.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── About + CTA ─── */}
      <section id="about" className="px-5 py-16 lg:px-8 lg:py-24">
        <div className="mx-auto grid max-w-7xl gap-6 lg:grid-cols-2">

          {/* About card */}
          <div className="rounded-2xl border border-fudo-border bg-white p-8">
            <p className="text-xs font-medium uppercase tracking-[0.15em] text-fudo-muted">
              О компании
            </p>
            <h2 className="mt-4 text-2xl font-black tracking-tight text-fudo-dark lg:text-3xl">
              DC Bakery — B2B-поставщик еды в Казахстане
            </h2>
            <p className="mt-4 text-sm leading-7 text-fudo-muted">
              Для закупщиков важны скорость, повторяемость и прозрачные условия.
              Интерфейс фокусируется на каталоге, остатках, B2B-ценах и удобном повторе заказов.
            </p>
            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              {contactInfo.map((item) => (
                <div key={item.label} className="rounded-xl bg-fudo-beige px-4 py-3">
                  <p className="text-xs font-medium text-fudo-muted">{item.label}</p>
                  <p className="mt-1 text-sm font-semibold text-fudo-dark">{item.value}</p>
                </div>
              ))}
            </div>
          </div>

          {/* CTA card */}
          <div className="rounded-2xl bg-fudo-dark p-8 text-white lg:p-10">
            <p className="text-xs font-medium uppercase tracking-[0.15em] text-fudo-accent">
              Начать закупку
            </p>
            <h2 className="mt-4 text-2xl font-black leading-snug tracking-tight text-white lg:text-3xl">
              Соберите первую оптовую заявку в каталоге
            </h2>
            <p className="mt-4 text-sm leading-7 text-white/70">
              Выберите позиции, проверьте остатки и отправьте заказ на подтверждение менеджеру.
            </p>
            <Link
              href="/catalog"
              className="mt-8 inline-flex items-center justify-center rounded-xl bg-fudo-accent px-8 py-4 text-sm font-semibold text-white transition hover:opacity-90"
            >
              Перейти в каталог
            </Link>
          </div>

        </div>
      </section>

    </main>
  );
}
