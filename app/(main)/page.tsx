import type { Metadata } from "next";
import Link from "next/link";
import { fetchCategories, fetchProducts } from "@/src/lib/catalog";
import { getSiteContent } from "@/src/lib/site-content";
import { getIsSuperAdmin } from "@/src/lib/superadmin";
import { getT } from "@/src/i18n/server";
import { promotions } from "@/src/data/promotions";
import { HomeCatalogTabs } from "@/src/components/home/HomeCatalogTabs";
import { PromoSection } from "@/src/components/home/PromoSection";
import { EditableText, SiteEditProvider } from "@/src/components/home/SiteEditMode";

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
  const [categories, allProducts, content, isSuperAdmin, t] = await Promise.all([
    fetchCategories(),
    fetchProducts(),
    getSiteContent(),
    getIsSuperAdmin(),
    getT(),
  ]);

  return (
    <SiteEditProvider isSuperAdmin={isSuperAdmin} content={content}>
      <main className="text-dark">

        {/* ─── Hero ─── */}
        <section className="border-b border-black/10 bg-white px-5 py-12 lg:px-8 lg:py-16">
          <div className="mx-auto max-w-7xl">
            <div className="grid items-end gap-10 lg:grid-cols-[1fr_auto]">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[.15em] text-muted">
                  {t("B2B поставщик · Казахстан")}
                </p>
                <h1 className="mt-4 font-display text-4xl font-semibold leading-tight tracking-tight sm:text-5xl lg:text-[3.25rem]">
                  <EditableText field="heroTitle" fallback={t(content.heroTitle)} multiline />
                </h1>
                <p className="mt-5 max-w-xl text-base leading-7 text-muted">
                  <EditableText field="heroSubtitle" fallback={t(content.heroSubtitle)} multiline />
                </p>
                <div className="mt-8 flex flex-wrap gap-3">
                  <Link href="/catalog"
                    className="rounded border border-dark bg-dark px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-dark/80">
                    {t("Открыть каталог")}
                  </Link>
                  <Link href="/profile"
                    className="rounded border border-black/20 px-5 py-2.5 text-sm font-semibold text-dark transition hover:bg-black/5">
                    {t("Стать партнёром")}
                  </Link>
                </div>
              </div>

              {/* Stat grid — desktop */}
              <div className="hidden grid-cols-2 gap-px border border-black/10 bg-black/10 lg:grid">
                {stats.map((stat) => (
                  <div key={stat.value} className="bg-white px-8 py-6">
                    <p className="font-data text-3xl font-semibold text-dark">{t(stat.value)}</p>
                    <p className="mt-2 text-xs leading-relaxed text-muted" style={{ whiteSpace: "pre-line" }}>
                      {t(stat.label)}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            {/* Stats — mobile */}
            <div className="mt-10 grid grid-cols-2 gap-px border border-black/10 bg-black/10 sm:grid-cols-4 lg:hidden">
              {stats.map((stat) => (
                <div key={stat.value} className="bg-white px-4 py-4">
                  <p className="font-data text-2xl font-semibold text-dark">{t(stat.value)}</p>
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
        <section id="about" className="border-t border-black/10 bg-white px-5 py-14 lg:px-8 lg:py-20">
          <div className="mx-auto max-w-7xl">
            <p className="text-[10px] font-semibold uppercase tracking-[.12em] text-muted">{t("О компании")}</p>
            <h2 className="mt-3 font-display text-2xl font-semibold tracking-tight lg:text-3xl">
              <EditableText field="aboutTitle" fallback={t(content.aboutTitle)} />
            </h2>
            <p className="mt-4 max-w-2xl text-sm leading-7 text-muted">
              <EditableText field="aboutText" fallback={t(content.aboutText)} multiline />
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
                  {t(item)}
                </li>
              ))}
            </ul>
            <div className="mt-8">
              <Link href="/profile"
                className="rounded border border-dark bg-dark px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-dark/80">
                {t("Стать партнёром")}
              </Link>
            </div>
          </div>
        </section>

      </main>
    </SiteEditProvider>
  );
}
