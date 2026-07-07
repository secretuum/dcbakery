import type { ReactNode } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { MIN_ORDER_AMOUNT } from "@/app/constants";
import { CategoryCard } from "@/src/components/catalog/CategoryCard";
import { ProductCard } from "@/src/components/catalog/ProductCard";
import { fetchCategories, fetchPopularProducts, fetchProducts } from "@/src/lib/catalog";
import { formatPrice } from "@/src/lib/format";
import type { Category } from "@/src/types";

export const metadata: Metadata = {
  title: "DC Bakery для бизнеса",
  description:
    "B2B-маркетплейс DC Bakery: десерты, полуфабрикаты и мясо для кофеен, ресторанов, магазинов и отелей.",
};

const orderSteps = [
  "Выберите товары",
  "Оформите заказ",
  "Менеджер подтвердит",
  "Доставка или самовывоз",
];

const advantages = [
  {
    title: "Открытые B2B-цены",
    desc: "Оптовые цены без скрытых наценок и звонка торговому представителю.",
    icon: (
      <svg className="h-5 w-5 text-coral" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
  {
    title: "Повторные заказы за 2 мин",
    desc: "История закупок всегда под рукой — повторите заявку в пару кликов.",
    icon: (
      <svg className="h-5 w-5 text-coral" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
      </svg>
    ),
  },
  {
    title: "Контроль остатков",
    desc: "Актуальные остатки и минимальные заказы видны прямо в каталоге.",
    icon: (
      <svg className="h-5 w-5 text-coral" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
      </svg>
    ),
  },
];

const promoCategory: Category = {
  id: "promo",
  name: "Акции",
  slug: "akcii",
  description: "Сезонные предложения и выгодные закупки для партнеров.",
  image: "/product-placeholder.png",
  parent_id: null,
  sort_order: 40,
  is_active: true,
};

function MetricIcon({ children }: { children: ReactNode }) {
  return (
    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-coral-light">
      {children}
    </div>
  );
}

export default async function Home() {
  const [categories, popularProducts, allProducts] = await Promise.all([
    fetchCategories(),
    fetchPopularProducts(4),
    fetchProducts(),
  ]);
  const homeCategories = [...categories, promoCategory];

  const metrics = [
    {
      label: "позиций в каталоге",
      value: String(allProducts.length),
      icon: (
        <svg className="h-5 w-5 text-coral" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
        </svg>
      ),
    },
    {
      label: "на повторный заказ",
      value: "2 мин",
      icon: (
        <svg className="h-5 w-5 text-coral" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
    },
    {
      label: "минимальный заказ",
      value: formatPrice(MIN_ORDER_AMOUNT),
      icon: (
        <svg className="h-5 w-5 text-coral" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
        </svg>
      ),
    },
  ];

  return (
    <main className="overflow-hidden bg-cream text-dark pb-52">
      {/* Hero */}
      <section className="relative px-5 pb-10 pt-8 lg:px-8 lg:pb-16 lg:pt-14">
        <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_1px_1px,rgba(139,26,74,0.14)_1px,transparent_0)] bg-[length:26px_26px]" />
        <div className="absolute inset-x-0 top-0 -z-10 h-72 bg-[linear-gradient(135deg,rgba(244,123,111,0.24),rgba(196,57,90,0.10),transparent)]" />

        <div className="mx-auto grid max-w-7xl gap-7 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
          <div className="rounded-2xl border border-black/10 bg-white/92 p-6 shadow-sm backdrop-blur sm:p-8 lg:p-10">
            <p className="inline-flex rounded-full bg-coral-light px-4 py-1.5 text-sm font-black text-burgundy">
              DC Bakery для бизнеса
            </p>
            <h1 className="mt-6 max-w-4xl break-words text-5xl font-black leading-[0.96] tracking-tight text-dark lg:text-6xl">
              Оптовые заказы десертов, полуфабрикатов и мяса
            </h1>
            <p className="mt-5 max-w-2xl text-lg text-muted">
              Для кофеен, ресторанов, магазинов и отелей. Без лишних звонков — каталог, остатки и история заказов в одном окне.
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link
                href="/catalog"
                className="inline-flex min-h-14 items-center justify-center rounded-xl bg-dark px-7 py-4 text-base font-black text-white transition hover:bg-burgundy"
              >
                Смотреть каталог
              </Link>
              <Link
                href="#terms"
                className="inline-flex min-h-14 items-center justify-center rounded-xl border-2 border-coral bg-transparent px-7 py-4 text-base font-black text-coral transition hover:bg-coral-light"
              >
                Стать партнером
              </Link>
            </div>
          </div>

          {/* Decorative blob */}
          <div className="relative hidden h-full min-h-[400px] items-center justify-center lg:flex">
            <div className="pointer-events-none absolute h-[440px] w-[440px] rounded-full bg-[radial-gradient(circle,rgba(244,123,111,0.38),rgba(196,57,90,0.18),transparent_68%)] blur-3xl opacity-90" />
            <div className="pointer-events-none absolute h-64 w-64 translate-x-20 translate-y-12 rounded-full bg-[radial-gradient(circle,rgba(139,26,74,0.22),transparent_70%)] blur-2xl" />
            <div className="pointer-events-none absolute h-48 w-48 -translate-x-16 -translate-y-10 rounded-full bg-[radial-gradient(circle,rgba(244,123,111,0.28),transparent_70%)] blur-2xl" />
          </div>
        </div>
      </section>

      {/* Metric cards */}
      <section className="px-5 pb-10 lg:px-8">
        <div className="mx-auto grid max-w-7xl gap-4 sm:grid-cols-3">
          {metrics.map((m) => (
            <div key={m.label} className="flex items-center gap-4 rounded-2xl border border-black/10 bg-white p-5 shadow-sm">
              <MetricIcon>{m.icon}</MetricIcon>
              <div>
                <p className="text-3xl font-black tracking-tight text-dark">{m.value}</p>
                <p className="mt-0.5 text-sm text-muted">{m.label}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Categories */}
      <section id="catalog" className="px-5 py-12 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-sm font-black uppercase text-raspberry">Категории</p>
              <h2 className="mt-2 break-words text-2xl font-black tracking-tight sm:text-4xl lg:text-5xl">
                Закупка по разделам
              </h2>
            </div>
            <Link href="/catalog" className="font-black text-coral transition hover:text-coral-hover">
              Весь каталог
            </Link>
          </div>

          <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {homeCategories.map((category) => (
              <CategoryCard
                key={category.id}
                category={category}
                href={category.id === "promo" ? "/catalog" : undefined}
                eyebrow={category.id === "promo" ? "выгода" : "раздел"}
              />
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="terms" className="px-5 py-12 lg:px-8">
        <div className="mx-auto max-w-7xl rounded-2xl bg-dark p-6 text-white shadow-sm sm:p-8 lg:p-10">
          <div className="grid gap-8 lg:grid-cols-[0.7fr_1.3fr] lg:items-start">
            <div>
              <p className="text-sm font-black uppercase text-coral-light">Как работает заказ</p>
              <h2 className="mt-3 break-words text-2xl font-black tracking-tight sm:text-4xl lg:text-5xl">
                Быстро, понятно, с подтверждением менеджера
              </h2>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {orderSteps.map((step, index) => (
                <div key={step} className="rounded-2xl bg-white/10 p-5">
                  <p className="text-4xl font-black text-coral">{index + 1}</p>
                  <p className="mt-8 text-lg font-black leading-6">{step}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Advantages + Delivery */}
      <section id="delivery" className="px-5 py-12 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="mb-8">
            <p className="text-sm font-black uppercase text-raspberry">Преимущества</p>
            <h2 className="mt-2 break-words text-2xl font-black tracking-tight sm:text-4xl">
              B2B-заказы в одном окне
            </h2>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            {advantages.map((a) => (
              <div key={a.title} className="flex items-start gap-4 rounded-2xl border border-black/10 bg-white p-5 shadow-sm">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-coral-light">
                  {a.icon}
                </div>
                <div>
                  <p className="font-black text-dark">{a.title}</p>
                  <p className="mt-1 text-sm text-muted">{a.desc}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-5 rounded-2xl bg-coral-light p-6 shadow-sm sm:p-8">
            <p className="text-sm font-black uppercase text-burgundy">Доставка</p>
            <h2 className="mt-3 break-words text-2xl font-black tracking-tight sm:text-4xl">Под ваш график поставок</h2>
            <p className="mt-5 text-base font-semibold leading-7 text-dark/70">
              Доставка и самовывоз остаются на подтверждении менеджера: он проверит остатки, время
              производства и удобный слот для вашей точки.
            </p>
            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl bg-white p-5">
                <p className="text-3xl font-black">24/7</p>
                <p className="mt-2 text-sm font-bold text-muted">оформление заявки онлайн</p>
              </div>
              <div className="rounded-2xl bg-white p-5">
                <p className="text-3xl font-black">1 кабинет</p>
                <p className="mt-2 text-sm font-bold text-muted">история и повтор заказов</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Popular products */}
      <section className="px-5 py-12 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-sm font-black uppercase text-raspberry">Популярные товары</p>
              <h2 className="mt-2 break-words text-2xl font-black tracking-tight sm:text-4xl lg:text-5xl">
                Часто берут партнеры
              </h2>
            </div>
          </div>

          <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {popularProducts.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        </div>
      </section>

      {/* About + CTA */}
      <section id="about" className="px-5 py-12 lg:px-8 lg:pb-20">
        <div className="mx-auto grid max-w-7xl gap-5 lg:grid-cols-[0.85fr_1.15fr]">
          <div className="rounded-2xl border border-black/10 bg-white p-6 shadow-sm sm:p-8">
            <p className="text-sm font-black uppercase text-raspberry">О компании</p>
            <h2 className="mt-3 break-words text-2xl font-black tracking-tight sm:text-4xl">
              DC Bakery строит B2B-маркетплейс еды
            </h2>
            <p className="mt-5 text-base font-semibold leading-7 text-muted">
              Для закупщиков важны скорость, повторяемость и прозрачные условия. Поэтому интерфейс
              фокусируется на каталоге, остатках, B2B-ценах и удобном повторе заказов.
            </p>
            <div className="mt-8 grid gap-3 text-sm font-bold text-muted sm:grid-cols-2">
              <p className="rounded-xl bg-cream px-4 py-3">Телефон: +7 700 000 00 00</p>
              <p className="rounded-xl bg-cream px-4 py-3">WhatsApp: +7 700 000 00 00</p>
              <p className="rounded-xl bg-cream px-4 py-3 sm:col-span-2">
                Адрес: Казахстан, уточняется
              </p>
              <p className="rounded-xl bg-cream px-4 py-3 sm:col-span-2">
                Время работы: ежедневно, 9:00-19:00
              </p>
            </div>
          </div>

          <div className="rounded-2xl bg-raspberry p-6 text-white shadow-sm sm:p-8 lg:p-10">
            <p className="text-sm font-black uppercase text-coral-light">Начать закупку</p>
            <h2 className="mt-3 max-w-3xl break-words text-2xl font-black tracking-tight sm:text-4xl lg:text-5xl">
              Соберите первую оптовую заявку в каталоге
            </h2>
            <p className="mt-5 max-w-2xl text-base font-semibold leading-7 text-white/80">
              Выберите позиции, проверьте остатки и отправьте заказ на подтверждение менеджеру.
            </p>
            <Link
              href="/catalog"
              className="mt-8 inline-flex min-h-14 items-center justify-center rounded-xl bg-white px-7 py-4 text-base font-black text-raspberry transition hover:bg-coral-light"
            >
              Перейти в каталог
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
