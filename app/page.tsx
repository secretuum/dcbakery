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
  "открытые B2B-цены",
  `минимальный заказ от ${formatPrice(MIN_ORDER_AMOUNT)}`,
  "повторные заказы",
  "контроль остатков",
  "заказ без торгового представителя",
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

export default async function Home() {
  const [categories, popularProducts, allProducts] = await Promise.all([
    fetchCategories(),
    fetchPopularProducts(4),
    fetchProducts(),
  ]);
  const homeCategories = [...categories, promoCategory];

  return (
    <main className="overflow-hidden bg-cream text-dark">
      <section className="relative px-5 pb-12 pt-8 lg:px-8 lg:pb-20 lg:pt-14">
        <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_1px_1px,rgba(139,26,74,0.14)_1px,transparent_0)] bg-[length:26px_26px]" />
        <div className="absolute inset-x-0 top-0 -z-10 h-72 bg-[linear-gradient(135deg,rgba(244,123,111,0.24),rgba(196,57,90,0.10),transparent)]" />

        <div className="mx-auto grid max-w-7xl gap-7 lg:grid-cols-[1.06fr_0.94fr] lg:items-stretch">
          <div className="rounded-card bg-white/92 p-6 shadow-[0_24px_90px_rgba(120,51,38,0.13)] backdrop-blur sm:p-8 lg:p-10">
            <p className="inline-flex rounded-badge bg-coral-light px-4 py-2 text-sm font-black text-burgundy">
              DC Bakery для бизнеса
            </p>
            <h1 className="mt-7 max-w-4xl text-5xl font-black leading-[0.96] tracking-tight text-dark sm:text-6xl lg:text-7xl">
              Оптовые заказы десертов, полуфабрикатов и мяса
            </h1>
            <p className="mt-6 max-w-2xl text-xl font-bold leading-8 text-dark/75 sm:text-2xl">
              Для кофеен, ресторанов, магазинов и отелей.
            </p>
            <p className="mt-5 max-w-2xl text-base leading-7 text-muted sm:text-lg">
              Заказывайте оптом онлайн: без лишних переписок, с историей заказов, остатками и
              быстрым повтором закупки.
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link
                href="/catalog"
                className="inline-flex min-h-14 items-center justify-center rounded-btn bg-coral px-7 py-4 text-base font-black text-white shadow-[0_18px_38px_rgba(244,123,111,0.28)] transition hover:bg-coral-hover"
              >
                Смотреть каталог
              </Link>
              <Link
                href="#terms"
                className="inline-flex min-h-14 items-center justify-center rounded-btn bg-dark px-7 py-4 text-base font-black text-white shadow-[0_18px_38px_rgba(28,28,28,0.16)] transition hover:bg-burgundy"
              >
                Стать партнером
              </Link>
            </div>
          </div>

          <div className="grid min-h-[520px] gap-4 rounded-card bg-coral-light p-4 shadow-[0_24px_90px_rgba(196,57,90,0.14)] sm:grid-cols-2">
            <div className="rounded-card bg-white p-5 shadow-sm">
              <p className="text-sm font-black uppercase text-raspberry">каталог</p>
              <p className="mt-3 text-5xl font-black tracking-tight">{allProducts.length}</p>
              <p className="mt-2 text-sm font-bold text-muted">позиций для закупки</p>
            </div>
            <div className="rounded-card bg-dark p-5 text-white shadow-sm sm:mt-10">
              <p className="text-sm font-black uppercase text-coral-light">повтор</p>
              <p className="mt-3 text-5xl font-black tracking-tight">2 мин</p>
              <p className="mt-2 text-sm font-bold text-white/70">на новую заявку</p>
            </div>
            <div className="rounded-card bg-cream p-5 shadow-sm">
              <p className="text-sm font-black uppercase text-burgundy">минимум</p>
              <p className="mt-3 text-4xl font-black tracking-tight">
                {formatPrice(MIN_ORDER_AMOUNT)}
              </p>
              <p className="mt-2 text-sm font-bold text-muted">для B2B-заказа</p>
            </div>
            <div className="rounded-card bg-white p-5 shadow-sm sm:mt-10">
              <div className="h-28 rounded-card bg-[repeating-linear-gradient(135deg,var(--dc-burgundy)_0_10px,var(--dc-coral)_10px_20px,var(--dc-cream)_20px_34px)]" />
              <p className="mt-4 text-xl font-black">умная закупка</p>
              <p className="mt-1 text-sm font-bold text-muted">остатки, цены, повторы</p>
            </div>
          </div>
        </div>
      </section>

      <section id="catalog" className="px-5 py-12 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-sm font-black uppercase text-raspberry">Категории</p>
              <h2 className="mt-2 text-4xl font-black tracking-tight sm:text-5xl">
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

      <section id="terms" className="px-5 py-12 lg:px-8">
        <div className="mx-auto max-w-7xl rounded-card bg-dark p-6 text-white shadow-[0_24px_80px_rgba(28,28,28,0.20)] sm:p-8 lg:p-10">
          <div className="grid gap-8 lg:grid-cols-[0.7fr_1.3fr] lg:items-start">
            <div>
              <p className="text-sm font-black uppercase text-coral-light">Как работает заказ</p>
              <h2 className="mt-3 text-4xl font-black tracking-tight sm:text-5xl">
                Быстро, понятно, с подтверждением менеджера
              </h2>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {orderSteps.map((step, index) => (
                <div key={step} className="rounded-card bg-white/10 p-5">
                  <p className="text-4xl font-black text-coral">{index + 1}</p>
                  <p className="mt-8 text-lg font-black leading-6">{step}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section id="delivery" className="px-5 py-12 lg:px-8">
        <div className="mx-auto grid max-w-7xl gap-5 lg:grid-cols-[1fr_1fr]">
          <div className="rounded-card bg-white p-6 shadow-[0_18px_60px_rgba(120,51,38,0.10)] sm:p-8">
            <p className="text-sm font-black uppercase text-raspberry">Преимущества</p>
            <h2 className="mt-3 text-4xl font-black tracking-tight">B2B-заказы в одном окне</h2>
            <div className="mt-8 grid gap-3">
              {advantages.map((advantage) => (
                <div key={advantage} className="rounded-btn bg-coral-light px-5 py-4 text-lg font-black">
                  {advantage}
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-card bg-coral-light p-6 shadow-[0_18px_60px_rgba(196,57,90,0.12)] sm:p-8">
            <p className="text-sm font-black uppercase text-burgundy">Доставка</p>
            <h2 className="mt-3 text-4xl font-black tracking-tight">Под ваш график поставок</h2>
            <p className="mt-5 text-base font-semibold leading-7 text-dark/70">
              Доставка и самовывоз остаются на подтверждении менеджера: он проверит остатки, время
              производства и удобный слот для вашей точки.
            </p>
            <div className="mt-8 grid gap-3 sm:grid-cols-2">
              <div className="rounded-card bg-white p-5">
                <p className="text-3xl font-black">24/7</p>
                <p className="mt-2 text-sm font-bold text-muted">оформление заявки онлайн</p>
              </div>
              <div className="rounded-card bg-white p-5">
                <p className="text-3xl font-black">1 кабинет</p>
                <p className="mt-2 text-sm font-bold text-muted">история и повтор заказов</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="px-5 py-12 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-sm font-black uppercase text-raspberry">Популярные товары</p>
              <h2 className="mt-2 text-4xl font-black tracking-tight sm:text-5xl">
                Часто берут партнеры
              </h2>
            </div>
            <p className="max-w-lg text-base font-semibold leading-7 text-muted">
              Пока это mock-данные из локального каталога. База, оплата и регистрация будут в
              следующих шагах.
            </p>
          </div>

          <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {popularProducts.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        </div>
      </section>

      <section id="about" className="px-5 py-12 lg:px-8 lg:pb-20">
        <div className="mx-auto grid max-w-7xl gap-5 lg:grid-cols-[0.85fr_1.15fr]">
          <div className="rounded-card bg-white p-6 shadow-[0_18px_60px_rgba(120,51,38,0.10)] sm:p-8">
            <p className="text-sm font-black uppercase text-raspberry">О компании</p>
            <h2 className="mt-3 text-4xl font-black tracking-tight">
              DC Bakery строит B2B-маркетплейс еды
            </h2>
            <p className="mt-5 text-base font-semibold leading-7 text-muted">
              Для закупщиков важны скорость, повторяемость и прозрачные условия. Поэтому интерфейс
              фокусируется на каталоге, остатках, B2B-ценах и удобном повторе заказов.
            </p>
            <div className="mt-8 grid gap-3 text-sm font-bold text-muted sm:grid-cols-2">
              <p className="rounded-btn bg-cream px-4 py-3">Телефон: +7 700 000 00 00</p>
              <p className="rounded-btn bg-cream px-4 py-3">WhatsApp: +7 700 000 00 00</p>
              <p className="rounded-btn bg-cream px-4 py-3 sm:col-span-2">
                Адрес: Казахстан, уточняется
              </p>
              <p className="rounded-btn bg-cream px-4 py-3 sm:col-span-2">
                Время работы: ежедневно, 9:00-19:00
              </p>
            </div>
          </div>

          <div className="rounded-card bg-raspberry p-6 text-white shadow-[0_24px_80px_rgba(196,57,90,0.22)] sm:p-8 lg:p-10">
            <p className="text-sm font-black uppercase text-coral-light">CTA</p>
            <h2 className="mt-3 max-w-3xl text-4xl font-black tracking-tight sm:text-5xl">
              Соберите первую оптовую заявку в каталоге
            </h2>
            <p className="mt-5 max-w-2xl text-base font-semibold leading-7 text-white/80">
              Выберите позиции, проверьте остатки и отправьте заказ на подтверждение менеджеру.
            </p>
            <Link
              href="/catalog"
              className="mt-8 inline-flex min-h-14 items-center justify-center rounded-btn bg-white px-7 py-4 text-base font-black text-raspberry transition hover:bg-coral-light"
            >
              Перейти в каталог
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
