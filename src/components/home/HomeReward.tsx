"use client";

import { FallbackImage } from "@/src/components/ui/FallbackImage";
import { EditableText } from "@/src/components/home/SiteEditMode";
import { useLocale, useT } from "@/src/i18n/client";
import { localizeProduct } from "@/src/i18n/product";
import type { Product } from "@/src/types";

type HomeRewardProps = {
  giftProducts?: Product[];
  /** Набрано за текущую неделю, ₸. Не передан → 0 (тизер на публичной главной). */
  collected?: number;
};

const THRESHOLD = 100000;

const MILESTONES = [
  { value: 35000, label: "35 000 ₸", caption: "старт недели" },
  { value: 70000, label: "70 000 ₸", caption: "почти у цели" },
  { value: 100000, label: "100 000 ₸", caption: "5 десертов" },
];

const GIFT_NAMES = [
  "Кукис",
  "Маффин шоколадный",
  "Синнабон",
  "Дениш с клубникой",
  "Тарталетка «Баннофи Пай»",
];

const TERMS = [
  "Учитываются подтверждённые, полностью оплаченные и переданные заказы одного участника (один БИН/ИИН) за неделю с понедельника по воскресенье по времени Алматы.",
  "Право на подарок возникает один раз за неделю независимо от суммы превышения.",
  "Подарок передаётся вместе со следующим подтверждённым заказом на следующей календарной неделе, отдельная доставка не производится.",
  "Акционная продукция не обменивается на деньги и не засчитывается как скидка.",
];

export function HomeReward({ giftProducts, collected: collectedProp }: HomeRewardProps) {
  const t = useT();
  const locale = useLocale();

  // Прогресс считается по реальным заказам клиента (0, пока заказов нет).
  const collected = Math.max(0, Math.round(collectedProp ?? 0));
  const pct = Math.min(100, Math.round((collected / THRESHOLD) * 100));
  const remaining = Math.max(THRESHOLD - collected, 0);
  const gifts = (giftProducts ?? []).slice(0, 5);
  const useThumbs = gifts.length > 0;

  return (
    <section className="py-14 sm:py-16" id="promo">
      <div className="mx-auto w-full max-w-[1240px] px-4 sm:px-6 lg:px-8">
        {/* section head */}
        <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
          <div>
            <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-accent-700">
              <EditableText field="home.reward.eyebrow" fallback={t("Бонусная программа")} />
            </span>
            <h2 className="mt-1 font-display text-[clamp(24px,3.4vw,34px)] font-extrabold tracking-tight text-dark">
              <EditableText field="home.reward.title" fallback={t("Награда за объём недели")} />
            </h2>
          </div>
        </div>

        {/* reward card */}
        <article className="relative overflow-hidden rounded-2xl bg-white shadow-md">
          <div className="grid gap-6 p-6 lg:grid-cols-[minmax(0,1fr)_320px] lg:gap-8 lg:p-8">
            {/* left column */}
            <div>
              <div className="flex flex-wrap items-center gap-3">
                <span className="inline-flex h-[30px] items-center gap-[7px] rounded-full bg-accent-50 px-3 text-[11px] font-bold uppercase tracking-[0.08em] text-accent-700">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                    <rect x="3" y="8" width="18" height="4" rx="1" />
                    <path d="M12 8v13M19 12v7a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-7" />
                    <path d="M7.5 8a2.5 2.5 0 0 1 0-5C11 3 12 8 12 8M16.5 8a2.5 2.5 0 0 0 0-5C13 3 12 8 12 8" />
                  </svg>
                  <EditableText field="home.reward.cardEyebrow" fallback={t("Бонусная программа")} />
                </span>
                <span className="inline-flex items-center gap-1.5 text-xs font-medium text-muted">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-coral" aria-hidden>
                    <circle cx="12" cy="12" r="10" />
                    <path d="M12 6v6l4 2" />
                  </svg>
                  <EditableText field="home.reward.dateLabel" fallback={t("с 1 августа по 30 ноября 2026")} />
                </span>
              </div>

              <h3 className="mt-4 font-display text-[clamp(24px,3vw,34px)] font-extrabold tracking-tight text-dark">
                <EditableText field="home.reward.headline" fallback={t("5 десертов в подарок за заказы недели")} />
              </h3>

              <div className="mt-5 flex flex-wrap items-baseline gap-3">
                <b className="font-display text-[clamp(32px,5vw,52px)] font-extrabold leading-none tracking-[-0.035em] text-dark tabular-nums">
                  {formatTenge(remaining)}
                </b>
                <span className="text-base text-muted">
                  <EditableText field="home.reward.progressToGift" fallback={t("до подарка")} /> ·{" "}
                  <EditableText field="home.reward.progressCollected" fallback={t("набрано")} />{" "}
                  {formatTenge(collected)}{" "}
                  <EditableText field="home.reward.progressOf" fallback={t("из")} />{" "}
                  {formatTenge(THRESHOLD)}
                </span>
              </div>

              {/* milestones scale */}
              <div className="mt-6">
                <div className="relative">
                  {/* track */}
                  <div className="relative h-10 overflow-hidden rounded-full bg-cream-warm">
                    <div
                      className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-accent-400 to-coral"
                      style={{ width: `${pct}%` }}
                    />
                  </div>

                  {/* nodes */}
                  <div className="pointer-events-none absolute inset-0 flex items-center">
                    {MILESTONES.map((m, i) => {
                      const at = (m.value / THRESHOLD) * 100;
                      const reached = pct >= at;
                      // Крайние узлы прижимаем к краям трека: без этого центрирующий
                      // -translate-x-1/2 выносил половину кружка за шкалу (на 100 000 — вправо).
                      const isFirst = i === 0;
                      const isLast = i === MILESTONES.length - 1;
                      const nodeTransform = isFirst
                        ? "translateX(0)"
                        : isLast
                          ? "translateX(-100%)"
                          : "translateX(-50%)";
                      return (
                        <span
                          key={m.value}
                          className={`absolute grid h-8 w-8 place-items-center rounded-full shadow-sm ${
                            reached ? "bg-accent-700 text-white" : "bg-white text-muted-light"
                          }`}
                          style={{ left: `${at}%`, transform: nodeTransform }}
                        >
                          {reached ? (
                            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                              <path d="M20 6 9 17l-5-5" />
                            </svg>
                          ) : (
                            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                              <circle cx="12" cy="12" r="4" />
                            </svg>
                          )}
                        </span>
                      );
                    })}
                  </div>
                </div>

                {/* labels */}
                <div className="relative mt-3 h-[34px]">
                  {MILESTONES.map((m, i) => {
                    const at = (m.value / THRESHOLD) * 100;
                    const reached = pct >= at;
                    const isFirst = i === 0;
                    const isLast = i === MILESTONES.length - 1;
                    const transform = isFirst
                      ? "translateX(0)"
                      : isLast
                        ? "translateX(-100%)"
                        : "translateX(-50%)";
                    return (
                      <span
                        key={m.value}
                        className="absolute whitespace-nowrap text-center"
                        style={{ left: `${at}%`, transform }}
                      >
                        <b className={`block text-[13.5px] font-bold tabular-nums ${reached ? "text-accent-700" : "text-dark"}`}>
                          {m.label}
                        </b>
                        <span className="mt-px block text-[10.5px] text-muted"><EditableText field={`home.reward.milestone${m.value}Caption`} fallback={t(m.caption)} /></span>
                      </span>
                    );
                  })}
                </div>
              </div>

              <p className="mt-5 text-sm text-muted">
                <EditableText field="home.reward.description" fallback={t("Оформляйте заказы на общую сумму от 100 000 ₸ за календарную неделю — и получайте комплимент: пять десертов на выбор вместе со следующим заказом.")} multiline />
              </p>
            </div>

            {/* gifts aside */}
            <aside className="rounded-[32px] bg-gradient-to-br from-cream-deep to-cream-warm p-5">
              <h4 className="text-[13.5px] font-bold text-dark"><EditableText field="home.reward.giftsTitle" fallback={t("Десерты на выбор")} /></h4>
              <div className="mt-4 grid grid-cols-5 gap-2">
                {useThumbs
                  ? gifts.map((p) => {
                      // Название десерта — из перевода каталога (name_kk/name_en).
                      const giftName = localizeProduct(p, locale).name;
                      return (
                        <div key={p.id} className="min-w-0 text-center">
                          <div className="relative aspect-square overflow-hidden rounded-xl bg-white shadow-sm">
                            <FallbackImage
                              src={p.images?.[0]}
                              alt={giftName}
                              fill
                              sizes="64px"
                              className="object-cover"
                              categoryId={p.category_id}
                              categorySlug={p.category?.slug}
                            />
                          </div>
                          <span className="mt-1.5 line-clamp-2 block text-[9.5px] font-medium leading-tight text-ink-soft">
                            {giftName}
                          </span>
                        </div>
                      );
                    })
                  : GIFT_NAMES.map((name, i) => (
                      <div key={name} className="min-w-0 text-center">
                        <div className="grid aspect-square place-items-center overflow-hidden rounded-xl bg-white text-coral shadow-sm">
                          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                            <rect x="3" y="8" width="18" height="4" rx="1" />
                            <path d="M12 8v13M19 12v7a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-7" />
                            <path d="M7.5 8a2.5 2.5 0 0 1 0-5C11 3 12 8 12 8M16.5 8a2.5 2.5 0 0 0 0-5C13 3 12 8 12 8" />
                          </svg>
                        </div>
                        <span className="mt-1.5 line-clamp-2 block text-[9.5px] font-medium leading-tight text-ink-soft">
                          <EditableText field={`home.reward.giftName${i}`} fallback={t(name)} />
                        </span>
                      </div>
                    ))}
              </div>
              <p className="mt-4 text-[11px] text-muted">
                <EditableText field="home.reward.giftsNote" fallback={t("Пять позиций на выбор партнёра — приезжают со следующим подтверждённым заказом.")} multiline />
              </p>
            </aside>
          </div>

          {/* expandable terms */}
          <details className="group border-t border-black/5">
            <summary className="flex w-full cursor-pointer list-none items-center gap-3 px-6 py-5 text-[13.5px] font-semibold text-ink-soft transition-colors hover:text-coral lg:px-8 [&::-webkit-details-marker]:hidden">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <path d="M14 2v6h6M16 13H8M16 17H8M10 9H8" />
              </svg>
              <EditableText field="home.reward.termsLabel" fallback={t("Условия акции")} />
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="ml-auto transition-transform group-open:rotate-180" aria-hidden>
                <path d="m6 9 6 6 6-6" />
              </svg>
            </summary>
            <div className="px-6 pb-6 lg:px-8">
              <ul className="grid gap-3">
                {TERMS.map((term, i) => (
                  <li key={term} className="flex gap-3 text-[13.5px] leading-relaxed text-ink-soft">
                    <span className="mt-2 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-accent-200" />
                    <EditableText field={`home.reward.term${i}`} fallback={t(term)} multiline />
                  </li>
                ))}
              </ul>
            </div>
          </details>
        </article>
      </div>
    </section>
  );
}

/** Форматирование суммы в тенге с пробелом-разделителем тысяч. */
function formatTenge(value: number) {
  return `${value.toLocaleString("ru-RU")} ₸`;
}
