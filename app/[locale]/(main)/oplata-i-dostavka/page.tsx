import type { Metadata } from "next";
import Link from "next/link";
import { getSiteContent } from "@/src/lib/site-content";
import { getLocale, getT } from "@/src/i18n/server";
import { withLocale, buildAlternates } from "@/src/i18n/routing";

export async function generateMetadata(): Promise<Metadata> {
  const [t, locale] = await Promise.all([getT(), getLocale()]);
  return {
    title: t("Оплата и доставка — DC Bakery"),
    description: t(
      "Способы оплаты, условия доставки и возврата для B2B-клиентов DC Bakery. Доставка по Алматы бесплатная, минимальный заказ 15 000 тенге.",
    ),
    alternates: buildAlternates("/oplata-i-dostavka", locale),
  };
}

export default async function OplataIDostavkaPage() {
  const content = await getSiteContent();
  const [t, locale] = await Promise.all([getT(), getLocale()]);
  const whatsappDigits = content.contactWhatsapp.replace(/\D/g, "");
  const phoneDigits = content.contactPhone.replace(/\D/g, "");

  return (
    <main className="min-h-screen bg-cream px-5 py-12 text-dark lg:px-8 lg:py-16">
      <div className="mx-auto max-w-3xl space-y-6">

        {/* Оплата */}
        <div className="rounded-card border border-black/10 bg-white p-8 sm:p-10">
          <p className="text-xs font-semibold uppercase tracking-[.15em] text-muted">{t("Для B2B-клиентов")}</p>
          <h1 className="mt-3 font-display text-3xl font-semibold tracking-tight sm:text-4xl">{t("Оплата и доставка")}</h1>
          <p className="mt-2 text-sm text-muted">
            {t("Все расчёты в тенге (KZT). Подробные условия — в")}{" "}
            <Link href={withLocale("/oferta", locale)} className="font-bold text-coral hover:underline">{t("Публичной оферте")}</Link>
            .
          </p>

          <div className="mt-8 border-t border-black/10 pt-8">
            <h2 className="font-display text-xl font-semibold">{t("Оплата")}</h2>
            <div className="mt-5 space-y-4">
              <div className="flex gap-4 rounded-card border border-black/5 bg-cream p-5">
                <div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded bg-coral font-data text-sm font-semibold text-white">
                  1
                </div>
                <div>
                  <p className="font-semibold text-dark">{t("Банковской картой онлайн")}</p>
                  <p className="mt-1 text-sm leading-6 text-muted">{t("Visa / Mastercard через защищённую платёжную страницу банка-эквайера. Данные карты вводятся на стороне банка и на сайте не хранятся. Средства списываются в момент оформления заказа.")}</p>
                </div>
              </div>
              <div className="flex gap-4 rounded-card border border-black/5 bg-cream p-5">
                <div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded bg-coral font-data text-sm font-semibold text-white">
                  2
                </div>
                <div>
                  <p className="font-semibold text-dark">{t("По счёту (безналичный расчёт)")}</p>
                  <p className="mt-1 text-sm leading-6 text-muted">
                    {t("Для одобренных B2B-клиентов — на условиях консигнации 7 дней. Оплата согласно выставленному счёту на банковский счёт Поставщика.")}{" "}
                    <Link href={withLocale("/contacts", locale)} className="font-bold text-coral hover:underline">{t("Реквизиты →")}</Link>
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Доставка */}
        <div className="rounded-card border border-black/10 bg-white p-8 sm:p-10">
          <h2 className="font-display text-xl font-semibold">{t("Доставка")}</h2>
          <div className="mt-5 rounded-card border border-black/5 bg-cream p-6 text-center">
            <p className="font-data text-2xl font-bold text-success">{t("Бесплатно")}</p>
            <p className="mt-1 text-xs font-semibold uppercase tracking-[.08em] text-muted">{t("на любой заказ по Алматы")}</p>
          </div>
          <div className="mt-5 space-y-3 text-sm leading-7 text-dark/80">
            <p>{t("Доставка по Алматы бесплатная на все заказы.")}</p>
            <p>{t("Минимальная сумма заказа — 15 000 ₸.")}</p>
            <p>{t("Способ (доставка или самовывоз) и точные сроки согласуются при подтверждении заказа менеджером.")}</p>
          </div>
        </div>

        {/* Возврат */}
        <div className="rounded-card border border-black/10 bg-white p-8 sm:p-10">
          <h2 className="font-display text-xl font-semibold">{t("Возврат")}</h2>
          <div className="mt-5 space-y-3 text-sm leading-7 text-dark/80">
            <p>{t("Продукция скоропортящаяся. Товар надлежащего качества возврату не подлежит.")}</p>
            <p>{t("Претензии по количеству и качеству принимаются только в момент приёмки и фиксируются актом. После подписания накладной претензии не рассматриваются.")}</p>
            <p>{t("При выявлении производственного брака Поставщик производит замену, допоставку или возврат стоимости.")}</p>
            <p>{t("Возврат средств по оплате картой — на ту же карту в срок до 10 рабочих дней с момента согласования возврата.")}</p>
            <p>
              {t("Подробнее —")}{" "}
              <Link href={withLocale("/oferta", locale)} className="font-bold text-coral hover:underline">{t("разделы 8–9 Публичной оферты")}</Link>
              . {t("По вопросам: e-mail")}{" "}
              <a href="mailto:info@dc-bakery.kz" className="font-bold text-coral hover:underline">
                info@dc-bakery.kz
              </a>
              , {t("тел.")}{" "}
              <a href={`tel:+${whatsappDigits}`} className="font-bold text-coral hover:underline">
                {content.contactWhatsapp}
              </a>
              {" "}{t("или")}{" "}
              <a href={`tel:+${phoneDigits}`} className="font-bold text-coral hover:underline">
                {content.contactPhone}
              </a>
              .
            </p>
          </div>
        </div>

      </div>
    </main>
  );
}
