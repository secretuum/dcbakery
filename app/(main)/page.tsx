import type { Metadata } from "next";
import Link from "next/link";
import { fetchCategories, fetchProducts } from "@/src/lib/catalog";
import { getSiteContent } from "@/src/lib/site-content";
import { getHomeLayout } from "@/src/lib/home-layout.server";
import { getIsSuperAdmin } from "@/src/lib/superadmin";
import { getT } from "@/src/i18n/server";
import { promotions } from "@/src/data/promotions";
import { HomeCatalogTabs } from "@/src/components/home/HomeCatalogTabs";
import { PromoSection } from "@/src/components/home/PromoSection";
import { EditableText, SiteEditProvider } from "@/src/components/home/SiteEditMode";
import { HomeBuilder, EnableBuilderGate } from "@/src/components/home/HomeBuilder";
import { JsonLd } from "@/src/components/seo/JsonLd";
import { SITE_URL } from "@/src/lib/site-url";

const organizationJsonLd = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "DC Bakery",
  url: SITE_URL,
  image: `${SITE_URL}/opengraph-image`,
  description:
    "B2B-поставщик десертов, полуфабрикатов и мяса для кофеен, ресторанов, магазинов и отелей. Алматы, Казахстан.",
  areaServed: "KZ",
};

export const metadata: Metadata = {
  title: "DC Bakery — B2B поставщик продуктов питания",
  description:
    "Поставки десертов, полуфабрикатов и мяса для кофеен, ресторанов, магазинов и отелей. Оптовые B2B-цены, халал сертификаты, натуральные ингредиенты.",
  alternates: { canonical: "/" },
};

const stats = [
  { value: "50+", label: "кофеен и ресторанов\nработают с нами" },
  { value: "98%", label: "заказов доставлено\nвовремя" },
  { value: "Халал", label: "сертификаты\nна всё мясо" },
  { value: "100%", label: "натуральные\nингредиенты" },
];

export default async function Home() {
  const [categories, allProducts, content, layout, isSuperAdmin, t] = await Promise.all([
    fetchCategories(),
    fetchProducts(),
    getSiteContent(),
    getHomeLayout(),
    getIsSuperAdmin(),
    getT(),
  ]);

  // Конструктор включён и есть что показывать → рендерим сетку вместо классической главной.
  if (layout.enabled && layout.sections.length > 0) {
    return (
      <>
        <JsonLd data={organizationJsonLd} />
        <HomeBuilder
          isSuperAdmin={isSuperAdmin}
          initialLayout={layout}
          bands={{
            promos: <PromoSection promotions={promotions} />,
            catalog: <HomeCatalogTabs categories={categories} products={allProducts} />,
          }}
        />
      </>
    );
  }

  return (
    <SiteEditProvider isSuperAdmin={isSuperAdmin} content={content}>
      <main className="text-dark">
        <JsonLd data={organizationJsonLd} />

        {/* ─── Hero ─── */}
        <section className="bg-gradient-to-b from-cream-deep to-cream px-5 py-14 lg:px-8 lg:py-20">
          <div className="mx-auto max-w-7xl">
            <div className="grid items-center gap-10 lg:grid-cols-[1.05fr_0.95fr]">
              <div>
                <span className="inline-flex items-center rounded-full bg-white px-3.5 py-1.5 text-xs font-bold uppercase tracking-[.12em] text-coral shadow-sm">
                  {t("B2B поставщик · Казахстан")}
                </span>
                <h1 className="mt-5 font-display text-4xl font-extrabold leading-[1.05] tracking-tight sm:text-5xl lg:text-6xl">
                  <EditableText field="heroTitle" fallback={t(content.heroTitle)} multiline />
                </h1>
                <p className="mt-5 max-w-xl text-base leading-7 text-ink-soft lg:text-lg">
                  <EditableText field="heroSubtitle" fallback={t(content.heroSubtitle)} multiline />
                </p>
                <div className="mt-8 flex flex-wrap gap-3">
                  <Link href="/catalog"
                    className="inline-flex min-h-12 items-center rounded-full bg-coral px-6 text-[15px] font-semibold text-white shadow-accent transition hover:bg-coral-hover active:scale-[.98]">
                    {t("Открыть каталог")}
                  </Link>
                  <Link href="/profile"
                    className="inline-flex min-h-12 items-center rounded-full border border-black/15 bg-white px-6 text-[15px] font-semibold text-dark transition hover:border-coral hover:text-coral">
                    {t("Стать партнёром")}
                  </Link>
                </div>
              </div>

              {/* Stat grid — desktop */}
              <div className="hidden grid-cols-2 gap-3 lg:grid">
                {stats.map((stat) => (
                  <div key={stat.value} className="rounded-xl bg-white p-6 shadow-sm">
                    <p className="font-data text-3xl font-bold text-coral">{t(stat.value)}</p>
                    <p className="mt-2 text-xs leading-relaxed text-muted" style={{ whiteSpace: "pre-line" }}>
                      {t(stat.label)}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            {/* Stats — mobile */}
            <div className="mt-10 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:hidden">
              {stats.map((stat) => (
                <div key={stat.value} className="rounded-xl bg-white p-4 shadow-sm">
                  <p className="font-data text-2xl font-bold text-coral">{t(stat.value)}</p>
                  <p className="mt-1.5 text-xs leading-relaxed text-muted" style={{ whiteSpace: "pre-line" }}>
                    {t(stat.label)}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ─── Promotions ─── */}
        <PromoSection promotions={promotions} />

        {/* ─── Catalog ─── */}
        <HomeCatalogTabs categories={categories} products={allProducts} />

        {/* ─── About ─── */}
        <section id="about" className="bg-cream px-5 py-16 lg:px-8 lg:py-24">
          <div className="mx-auto max-w-7xl rounded-3xl bg-white p-8 shadow-sm lg:p-14">
            <p className="text-[10px] font-bold uppercase tracking-[.12em] text-coral">{t("О компании")}</p>
            <h2 className="mt-3 font-display text-2xl font-extrabold tracking-tight lg:text-3xl">
              <EditableText field="aboutTitle" fallback={t(content.aboutTitle)} />
            </h2>
            <p className="mt-4 max-w-2xl text-[15px] leading-7 text-ink-soft">
              <EditableText field="aboutText" fallback={t(content.aboutText)} multiline />
            </p>
            <ul className="mt-6 grid gap-2.5 sm:grid-cols-2">
              {[
                "Халал сертификаты на всё мясо и полуфабрикаты",
                "Натуральные ингредиенты без консервантов",
                "Доставка 98% заказов вовремя",
                "Личный менеджер для каждого партнёра",
              ].map((item) => (
                <li key={item} className="flex items-start gap-2.5 text-sm font-medium text-dark">
                  <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-coral" />
                  {t(item)}
                </li>
              ))}
            </ul>
            <div className="mt-8">
              <Link href="/profile"
                className="inline-flex min-h-12 items-center rounded-full bg-espresso px-6 text-[15px] font-semibold text-white transition hover:bg-espresso/90 active:scale-[.98]">
                {t("Стать партнёром")}
              </Link>
            </div>
          </div>
        </section>

        {/* ─── Final CTA ─── */}
        <section className="px-5 pb-16 lg:px-8 lg:pb-24">
          <div className="mx-auto max-w-7xl overflow-hidden rounded-3xl bg-coral px-8 py-14 text-center text-white lg:py-20">
            <h2 className="mx-auto max-w-2xl font-display text-3xl font-extrabold leading-tight tracking-tight lg:text-4xl">
              {t("Соберите первую оптовую заявку")}
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-[15px] leading-7 text-white/85">
              {t("Оптовые цены, живые остатки и товарный кредит — всё в одном кабинете.")}
            </p>
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <Link href="/catalog"
                className="inline-flex min-h-12 items-center rounded-full bg-white px-6 text-[15px] font-semibold text-coral shadow-sm transition hover:bg-white/90 active:scale-[.98]">
                {t("Открыть каталог")}
              </Link>
              <Link href="/profile"
                className="inline-flex min-h-12 items-center rounded-full border border-white/25 bg-white/10 px-6 text-[15px] font-semibold text-white transition hover:bg-white/20 active:scale-[.98]">
                {t("Стать партнёром")}
              </Link>
            </div>
          </div>
        </section>

      </main>
      <EnableBuilderGate isSuperAdmin={isSuperAdmin} />
    </SiteEditProvider>
  );
}
