import type { Promotion } from "@/src/data/promotions";
import { getT } from "@/src/i18n/server";

type Props = {
  promotions: Promotion[];
};

export async function PromoSection({ promotions }: Props) {
  if (promotions.length === 0) {
    return null;
  }

  const t = await getT();

  return (
    <section id="promo" className="border-t border-black/10 bg-white px-5 py-14 lg:px-8 lg:py-20">
      <div className="mx-auto max-w-7xl">
        <div className="flex flex-col gap-2">
          <p className="text-[10px] font-semibold uppercase tracking-[.12em] text-muted">
            {t("Акции и бонусы")}
          </p>
          <h2 className="font-display text-3xl font-bold tracking-tight text-dark lg:text-4xl">
            {t("Акции DC Bakery")}
          </h2>
        </div>

        <div className="mt-7 space-y-5">
          {promotions.map((promo) => (
            <article
              key={promo.id}
              className="grid overflow-hidden border border-black/10 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1.6fr)]"
            >
              {/* Offer */}
              <div className="flex flex-col justify-between gap-6 bg-cream p-6 lg:border-r lg:border-black/10 lg:p-8">
                <div>
                  <span className="inline-block border border-coral bg-coral px-2.5 py-1 text-[10px] font-bold uppercase tracking-[.1em] text-white">
                    {t(promo.badge)}
                  </span>
                  <h3 className="mt-4 font-display text-xl font-bold tracking-tight text-dark lg:text-2xl">
                    {t(promo.title)}
                  </h3>
                  <p className="mt-3 text-sm leading-6 text-muted">{t(promo.summary)}</p>
                </div>
                <div>
                  <div className="border border-black/10 bg-white p-4">
                    <p className="font-data text-lg font-semibold text-dark">
                      {t(promo.highlight.condition)}
                    </p>
                    <p className="mt-1 font-data text-lg font-semibold text-coral">
                      → {t(promo.highlight.reward)}
                    </p>
                  </div>
                  <p className="mt-3 text-xs font-semibold uppercase tracking-[.08em] text-muted">
                    {t(promo.periodLabel)}
                  </p>
                </div>
              </div>

              {/* Conditions */}
              <div className="p-6 lg:p-8">
                <p className="text-[10px] font-semibold uppercase tracking-[.12em] text-muted">
                  {t("Условия")}
                </p>
                <ul className="mt-3 space-y-2.5">
                  {promo.details.map((detail) => (
                    <li key={detail} className="flex items-start gap-2.5 text-sm leading-6 text-dark">
                      <span className="mt-2 size-1.5 shrink-0 rounded-full bg-coral" />
                      {t(detail)}
                    </li>
                  ))}
                </ul>
                {promo.giftOptions && promo.giftOptions.length > 0 ? (
                  <div className="mt-5 border-t border-black/10 pt-4">
                    <p className="text-[10px] font-semibold uppercase tracking-[.12em] text-muted">
                      {t("Десерты на выбор")}
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {promo.giftOptions.map((gift) => (
                        <span
                          key={gift}
                          className="border border-black/10 bg-cream px-3 py-1.5 text-xs font-semibold text-dark"
                        >
                          {t(gift)}
                        </span>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
