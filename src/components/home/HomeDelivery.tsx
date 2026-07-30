"use client";

import Link from "next/link";
import { useT } from "@/src/i18n/client";
import { EditableText } from "@/src/components/home/SiteEditMode";

/**
 * Тёмный блок «как работает заказ» + доставка.
 * Бизнес-правила актуальные: минимума нет; доставка бесплатно от 15 000 ₸,
 * 1 500 ₸ при 10 000–15 000 ₸, 3 000 ₸ дешевле 10 000 ₸; вт · чт · сб, приём до 18:00.
 */
export function HomeDelivery() {
  const t = useT();

  const steps: { n: string; title: string; text: string }[] = [
    { n: "01", title: t("Каталог"), text: t("Соберите корзину в каталоге — минимальной суммы заказа нет.") },
    { n: "02", title: t("Заявка"), text: t("Оформите заявку — данные компании и удобный слот доставки.") },
    { n: "03", title: t("Подтверждение менеджера"), text: t("Менеджер проверит остатки и согласует день доставки.") },
    { n: "04", title: t("Счёт в WhatsApp"), text: t("Счёт с реквизитами приходит в WhatsApp и на почту.") },
    { n: "05", title: t("Оплата"), text: t("Оплата по счёту или консигнация — отсрочка 7 дней.") },
    { n: "06", title: t("Доставка"), text: t("Вт · чт · сб. Приём заявок до 18:00 накануне.") },
  ];

  const infoCards: { eyebrow: string; value: string; note: string }[] = [
    {
      eyebrow: t("График поставок"),
      value: t("Вторник · Четверг · Суббота"),
      note: t("Приём заявок до 18:00 накануне дня доставки"),
    },
    {
      eyebrow: t("Минимальный заказ"),
      value: t("Без минимума"),
      note: t("Заказывайте от одной позиции — порога суммы нет"),
    },
    {
      eyebrow: t("Стоимость доставки"),
      value: t("Бесплатно от 15 000 ₸"),
      note: t("1 500 ₸ при 10 000–15 000 ₸ · 3 000 ₸ дешевле 10 000 ₸"),
    },
  ];

  return (
    <section className="py-12 md:py-20" id="delivery">
      <div className="mx-auto w-full max-w-7xl px-5 lg:px-8">
        <div className="rounded-3xl bg-espresso p-6 text-white md:p-10">
          {/* section head */}
          <div className="mb-6 flex flex-col gap-3 md:mb-8 md:flex-row md:items-end md:justify-between md:gap-6">
            <div className="min-w-0">
              <span className="mb-2 block font-display text-[11px] font-semibold uppercase tracking-[0.14em] text-accent-200">
                <EditableText field="home.delivery.eyebrow" fallback={t("Как работает заказ")} />
              </span>
              <h2 className="max-w-[18ch] font-display text-[clamp(24px,3vw,34px)] font-bold leading-tight text-white">
                <EditableText field="home.delivery.heading" fallback={t("Заявка → подтверждение → счёт → доставка")} />
              </h2>
            </div>
            <div className="flex-shrink-0">
              <Link
                href="/oplata-i-dostavka"
                className="inline-flex min-h-[42px] items-center justify-center gap-2 rounded-full border border-white/25 bg-white/10 px-[22px] text-[13.5px] font-semibold text-white transition-colors hover:bg-white/20"
              >
                <EditableText field="home.delivery.link" fallback={t("Оплата и доставка")} />
              </Link>
            </div>
          </div>

          {/* workflow steps */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:gap-5 lg:grid-cols-3">
            {steps.map((s) => (
              <div key={s.n} className="rounded-xl border border-white/[0.14] bg-white/[0.06] p-5 backdrop-blur-xl">
                <p className="font-data text-[clamp(19px,2vw,24px)] font-semibold tabular-nums text-accent-300">{s.n}</p>
                <p className="mt-5 font-display text-[17px] font-bold text-white">
                  <EditableText field={`home.delivery.step${s.n}.title`} fallback={t(s.title)} />
                </p>
                <p className="mt-2 text-[13.5px] leading-relaxed text-white/[0.68]">
                  <EditableText field={`home.delivery.step${s.n}.text`} fallback={t(s.text)} multiline />
                </p>
              </div>
            ))}
          </div>

          {/* delivery schedule glass cards */}
          <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 md:gap-5 lg:grid-cols-3">
            {infoCards.map((c, i) => (
              <div key={c.eyebrow} className="rounded-xl border border-white/[0.14] bg-white/[0.06] p-5 backdrop-blur-xl">
                <p className="font-display text-[11px] font-semibold uppercase tracking-[0.14em] text-accent-200">
                  <EditableText field={`home.delivery.info${i}.eyebrow`} fallback={t(c.eyebrow)} />
                </p>
                <p className="mt-2 font-display text-[17px] font-bold tabular-nums text-white">
                  <EditableText field={`home.delivery.info${i}.value`} fallback={t(c.value)} />
                </p>
                <p className="mt-2 text-[12px] text-white/[0.68]">
                  <EditableText field={`home.delivery.info${i}.note`} fallback={t(c.note)} multiline />
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
