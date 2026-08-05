import type { Metadata } from "next";
import Link from "next/link";
import { fetchCategories, fetchProducts } from "@/src/lib/catalog";
import { getSiteContent } from "@/src/lib/site-content";
import { getLocale, getT } from "@/src/i18n/server";
import { withLocale, buildAlternates } from "@/src/i18n/routing";
import { RETAIL_SITE_URL } from "@/app/constants";
import { HomeCatalogTabs } from "@/src/components/home/HomeCatalogTabs";
import { HomeCatBar } from "@/src/components/home/HomeCatBar";
import { HomeReward } from "@/src/components/home/HomeReward";
import { HomePopularPosters } from "@/src/components/home/HomePopularPosters";
import { HomeCategoryCards } from "@/src/components/home/HomeCategoryCards";
import { HomeDelivery } from "@/src/components/home/HomeDelivery";
import { EditableText, EditableImage } from "@/src/components/home/SiteEditMode";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  return {
    title: "DC Bakery — B2B поставщик продуктов питания",
    description:
      "Поставки десертов, полуфабрикатов и мяса для кофеен, ресторанов, магазинов и отелей. Оптовые B2B-цены, халал сертификаты, натуральные ингредиенты.",
    alternates: buildAlternates("/", locale),
  };
}

const stats = [
  { value: "50+", label: "кофеен и ресторанов\nработают с нами" },
  { value: "98%", label: "заказов доставлено\nвовремя" },
  { value: "Халал", label: "сертификаты\nна всё мясо" },
  { value: "100%", label: "натуральные\nингредиенты" },
];

export default async function Home() {
  const [categories, allProducts, content, t, locale] = await Promise.all([
    fetchCategories(),
    fetchProducts(),
    getSiteContent(),
    getT(),
    getLocale(),
  ]);

  const categoryCounts = allProducts.reduce<Record<string, number>>((acc, p) => {
    acc[p.category_id] = (acc[p.category_id] ?? 0) + 1;
    return acc;
  }, {});
  const dessertGifts = allProducts
    .filter((p) => (p.category?.name ?? "").toLowerCase().includes("десерт"))
    .slice(0, 5);
  const popularProducts = allProducts.slice(0, 6);

  return (
    <main className="text-dark">
        {/* ─── Hero ─── */}
        <section
          className="relative overflow-hidden"
          style={{
            background:
              "radial-gradient(120% 90% at 78% 8%, rgba(240,144,144,0.30) 0%, transparent 58%), radial-gradient(90% 70% at 6% 96%, rgba(168,24,96,0.10) 0%, transparent 60%), linear-gradient(168deg, var(--dc-cream) 0%, var(--dc-cream-deep) 46%, var(--dc-cream-warm) 100%)",
          }}
        >
          {/* грейн */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 opacity-40"
            style={{
              backgroundImage: "radial-gradient(circle at 1px 1px, rgba(86,34,13,0.09) 1px, transparent 0)",
              backgroundSize: "22px 22px",
            }}
          />

          <div className="relative mx-auto max-w-7xl px-5 pb-14 pt-10 lg:px-8 lg:pb-20 lg:pt-14">
            <div className="grid gap-8 lg:grid-cols-[1.02fr_0.98fr] lg:items-center lg:gap-10">
              {/* Контент */}
              <div className="relative z-[2] max-w-[640px]">
                <span className="inline-flex h-[34px] items-center gap-2 rounded-full border border-white/80 bg-white/70 px-3.5 text-xs font-semibold text-accent-700 backdrop-blur-md">
                  <span className="size-[7px] rounded-full bg-coral" />
                  <EditableText field="home.hero.badge" fallback={t("B2B-поставки · Алматы")} />
                </span>
                <h1 className="mt-5 font-display text-[clamp(38px,7.4vw,72px)] font-extrabold leading-[0.98] tracking-[-0.035em]" style={{ whiteSpace: "pre-line" }}>
                  <EditableText field="heroTitle" fallback={t(content.heroTitle)} multiline />
                </h1>
                <p className="mt-5 max-w-[30em] text-[17px] leading-[1.6] text-ink-soft">
                  <EditableText field="heroSubtitle" fallback={t(content.heroSubtitle)} multiline />
                </p>
                <div className="mt-7 flex flex-wrap gap-3">
                  <Link href={withLocale("/catalog", locale)}
                    className="inline-flex min-h-14 items-center gap-2 rounded-full bg-coral px-[30px] text-[17px] font-semibold text-white shadow-accent transition hover:bg-coral-hover active:scale-[.98]">
                    <EditableText field="home.hero.ctaPrimary" fallback={t("Открыть каталог")} />
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
                  </Link>
                  <Link href={withLocale("/profile", locale)}
                    className="inline-flex min-h-14 items-center rounded-full border border-black/15 bg-white px-[30px] text-[17px] font-semibold text-dark transition hover:border-coral hover:text-coral">
                    <EditableText field="home.hero.ctaSecondary" fallback={t("Стать партнёром")} />
                  </Link>
                </div>
                <div className="mt-4 flex flex-wrap items-center gap-2 text-sm text-muted">
                  <span><EditableText field="home.hero.retailPrompt" fallback={t("Нужен один торт или коробка пирожных?")} /></span>
                  <a href={RETAIL_SITE_URL} target="_blank" rel="noopener noreferrer" className="font-semibold text-coral hover:underline">
                    <EditableText field="home.hero.retailLink" fallback={t("Заказать в розницу →")} />
                  </a>
                </div>
              </div>

              {/* Сцена — слоёные фото продукции */}
              <div aria-hidden className="relative z-[1] mx-auto aspect-square w-full max-w-[520px] lg:aspect-[1/1.02] lg:max-w-none">
                {/* главный кадр — чистое фото без ореолов/тени/обводки */}
                <div
                  className="absolute overflow-hidden rounded-[2.2rem]"
                  style={{ inset: "3% 11% 7% 11%" }}
                >
                  <EditableImage field="home.hero.imgMain" fallbackSrc="/products/tort-medovik.webp" alt="" className="h-full w-full object-cover" />
                </div>
                {/* фото A — акцент справа сверху, лёгкий наклон */}
                <div
                  className="absolute overflow-hidden rounded-[1.4rem]"
                  style={{ width: "33%", aspectRatio: "3 / 4", right: "-2%", top: "7%", rotate: "4deg" }}
                >
                  <EditableImage field="home.hero.imgA" fallbackSrc="/products/ispanskiy-chizkeyk.webp" alt="" className="h-full w-full object-cover" />
                </div>
                {/* фото B — акцент слева снизу */}
                <div
                  className="absolute overflow-hidden rounded-[1.2rem]"
                  style={{ width: "28%", aspectRatio: "1 / 1", left: "-3%", bottom: "11%", rotate: "-5deg" }}
                >
                  <EditableImage field="home.hero.imgB" fallbackSrc="/products/shu-yagodnyy.webp" alt="" className="h-full w-full object-cover" />
                </div>
                {/* плавающий тег */}
                <div className="absolute flex items-center gap-3 rounded-full border border-white/80 bg-white/[0.86] py-2.5 pl-2.5 pr-4 shadow-md backdrop-blur-lg" style={{ right: "4%", bottom: "6%" }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src="/products/pelmeni-s-govyadinoy.webp" alt="" className="size-10 rounded-full object-cover" />
                  <span className="leading-tight">
                    <b className="block text-sm font-bold text-dark"><EditableText field="home.hero.tagCount" fallback={t("53 позиции")} /></b>
                    <span className="block text-[11px] text-muted"><EditableText field="home.hero.tagKinds" fallback={t("десерты · полуфабрикаты · мясо")} /></span>
                  </span>
                </div>
              </div>
            </div>

            {/* Показатели — стеклянные */}
            <div className="mt-10 grid grid-cols-2 gap-px overflow-hidden rounded-xl bg-black/10 shadow-md sm:grid-cols-4 lg:mt-14">
              {stats.map((stat, i) => (
                <div key={stat.value} className="bg-white/90 px-4 py-5 text-center backdrop-blur-md sm:px-5 sm:py-6">
                  <b className="block font-display text-[clamp(24px,3.6vw,36px)] font-extrabold leading-none tracking-[-0.03em] text-coral">{t(stat.value)}</b>
                  <span className="mt-2 block text-xs leading-tight text-muted" style={{ whiteSpace: "pre-line" }}><EditableText field={`home.hero.stat${i}Label`} fallback={t(stat.label)} multiline /></span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ─── Навигация по разделам ─── */}
        <HomeCatBar categories={categories} counts={categoryCounts} />

        {/* ─── Промо «5 десертов» ─── */}
        <HomeReward giftProducts={dessertGifts} />

        {/* ─── Популярное (poster-карточки) ─── */}
        <HomePopularPosters products={popularProducts} />

        {/* ─── Разделы каталога ─── */}
        <HomeCategoryCards categories={categories} counts={categoryCounts} />

        {/* ─── Ленты товаров ─── */}
        <HomeCatalogTabs categories={categories} products={allProducts} />

        {/* ─── Доставка / как работает заказ ─── */}
        <HomeDelivery />

        {/* ─── About ─── */}
        <section id="about" className="bg-cream px-5 py-16 lg:px-8 lg:py-24">
          <div className="mx-auto grid max-w-7xl gap-8 rounded-3xl bg-white p-8 shadow-sm lg:grid-cols-[1.1fr_0.9fr] lg:items-center lg:gap-14 lg:p-14">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[.12em] text-coral"><EditableText field="home.about.eyebrow" fallback={t("О компании")} /></p>
              <h2 className="mt-3 font-display text-2xl font-extrabold tracking-tight lg:text-3xl">
                <EditableText field="aboutTitle" fallback={t(content.aboutTitle)} />
              </h2>
              <p className="mt-4 text-[15px] leading-7 text-ink-soft">
                <EditableText field="aboutText" fallback={t(content.aboutText)} multiline />
              </p>
              <ul className="mt-6 grid gap-2.5 sm:grid-cols-2">
                {[
                  "Халал сертификаты на всё мясо и полуфабрикаты",
                  "Натуральные ингредиенты без консервантов",
                  "Доставка 98% заказов вовремя",
                  "Личный менеджер для каждого партнёра",
                ].map((item, i) => (
                  <li key={item} className="flex items-start gap-2.5 text-sm font-medium text-dark">
                    <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-coral" />
                    <EditableText field={`home.about.feat${i}`} fallback={t(item)} />
                  </li>
                ))}
              </ul>
              <div className="mt-6 flex flex-wrap gap-2">
                {["Собственное производство", "Пекарня полного цикла", "Халал"].map((chip, i) => (
                  <span key={chip} className="rounded-full bg-cream-deep px-3.5 py-2 text-xs font-semibold text-ink-soft">
                    <EditableText field={`home.about.chip${i}`} fallback={t(chip)} />
                  </span>
                ))}
              </div>
              <div className="mt-8">
                <Link href={withLocale("/profile", locale)}
                  className="inline-flex min-h-12 items-center rounded-full bg-espresso px-6 text-[15px] font-semibold text-white transition hover:bg-espresso/90 active:scale-[.98]">
                  <EditableText field="home.about.cta" fallback={t("Стать партнёром")} />
                </Link>
              </div>
            </div>

            {/* фото-коллаж */}
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2 aspect-[16/10] overflow-hidden rounded-2xl bg-cream">
                <EditableImage field="home.about.img1" fallbackSrc="/products/tort-medovik.webp" alt="" className="h-full w-full object-cover" />
              </div>
              <div className="aspect-square overflow-hidden rounded-2xl bg-cream">
                <EditableImage field="home.about.img2" fallbackSrc="/products/ispanskiy-chizkeyk.webp" alt="" className="h-full w-full object-cover" />
              </div>
              <div className="aspect-square overflow-hidden rounded-2xl bg-cream">
                <EditableImage field="home.about.img3" fallbackSrc="/products/shu-yagodnyy.webp" alt="" className="h-full w-full object-cover" />
              </div>
            </div>
          </div>
        </section>

        {/* ─── Final CTA ─── */}
        <section className="px-5 pb-16 lg:px-8 lg:pb-24">
          <div className="mx-auto max-w-7xl overflow-hidden rounded-3xl bg-coral px-8 py-14 text-center text-white lg:py-20">
            <h2 className="mx-auto max-w-2xl font-display text-3xl font-extrabold leading-tight tracking-tight lg:text-4xl">
              <EditableText field="home.cta.title" fallback={t("Соберите первую оптовую заявку")} />
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-[15px] leading-7 text-white/85">
              <EditableText field="home.cta.subtitle" fallback={t("Оптовые цены, живые остатки и доступный лимит — всё в одном кабинете.")} multiline />
            </p>
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <Link href={withLocale("/catalog", locale)}
                className="inline-flex min-h-12 items-center rounded-full bg-white px-6 text-[15px] font-semibold text-coral shadow-sm transition hover:bg-white/90 active:scale-[.98]">
                <EditableText field="home.cta.primary" fallback={t("Открыть каталог")} />
              </Link>
              <Link href={withLocale("/profile", locale)}
                className="inline-flex min-h-12 items-center rounded-full border border-white/25 bg-white/10 px-6 text-[15px] font-semibold text-white transition hover:bg-white/20 active:scale-[.98]">
                <EditableText field="home.cta.secondary" fallback={t("Стать партнёром")} />
              </Link>
            </div>
          </div>
        </section>

      </main>
  );
}
