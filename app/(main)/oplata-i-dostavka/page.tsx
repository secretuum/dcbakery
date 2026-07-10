import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Оплата и доставка — DC Bakery",
  description:
    "Способы оплаты, условия доставки и возврата для B2B-клиентов DC Bakery. Минимальный заказ 15 000 тенге, бесплатная доставка.",
};

export default function OplataIDostavkaPage() {
  return (
    <main className="min-h-screen bg-cream px-5 py-12 text-dark lg:px-8 lg:py-16">
      <div className="mx-auto max-w-3xl space-y-6">

        {/* Оплата */}
        <div className="rounded-card bg-white p-8 shadow-sm sm:p-10">
          <p className="text-sm font-black uppercase text-raspberry">Для B2B-клиентов</p>
          <h1 className="mt-3 text-3xl font-black tracking-tight sm:text-4xl">Оплата и доставка</h1>
          <p className="mt-2 text-sm text-muted">
            Все расчёты в тенге (KZT). Подробные условия — в{" "}
            <Link href="/oferta" className="font-bold text-coral hover:underline">
              Публичной оферте
            </Link>
            .
          </p>

          <div className="mt-8 border-t border-black/10 pt-8">
            <h2 className="text-xl font-black">Оплата</h2>
            <div className="mt-5 space-y-4">
              <div className="flex gap-4 rounded-card bg-cream p-5">
                <div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full bg-coral text-sm font-black text-white">
                  1
                </div>
                <div>
                  <p className="font-black text-dark">Банковской картой онлайн</p>
                  <p className="mt-1 text-sm leading-6 text-muted">
                    Visa / Mastercard через защищённую платёжную страницу банка-эквайера.
                    Данные карты вводятся на стороне банка и на сайте не хранятся.
                    Средства списываются в момент оформления заказа.
                  </p>
                </div>
              </div>
              <div className="flex gap-4 rounded-card bg-cream p-5">
                <div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full bg-coral text-sm font-black text-white">
                  2
                </div>
                <div>
                  <p className="font-black text-dark">По счёту (безналичный расчёт)</p>
                  <p className="mt-1 text-sm leading-6 text-muted">
                    Для одобренных B2B-клиентов — на условиях консигнации 3–4 дня.
                    Оплата согласно выставленному счёту на банковский счёт Поставщика.{" "}
                    <Link href="/contacts" className="font-bold text-coral hover:underline">
                      Реквизиты →
                    </Link>
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Доставка */}
        <div className="rounded-card bg-white p-8 shadow-sm sm:p-10">
          <h2 className="text-xl font-black">Доставка</h2>
          <div className="mt-5 grid gap-4 sm:grid-cols-3">
            <div className="rounded-card bg-cream p-5 text-center">
              <p className="text-2xl font-black text-coral">15 000 ₸</p>
              <p className="mt-1 text-xs font-black uppercase text-muted">Минимальный заказ</p>
            </div>
            <div className="rounded-card bg-cream p-5 text-center">
              <p className="text-2xl font-black text-coral">0 ₸</p>
              <p className="mt-1 text-xs font-black uppercase text-muted">Доставка от минимума</p>
            </div>
            <div className="rounded-card bg-cream p-5 text-center">
              <p className="text-2xl font-black text-coral">1 500–3 000 ₸</p>
              <p className="mt-1 text-xs font-black uppercase text-muted">Доставка ниже минимума</p>
            </div>
          </div>
          <div className="mt-5 space-y-3 text-sm leading-7 text-dark/80">
            <p>При заказе от 15 000 тенге доставка бесплатная.</p>
            <p>При меньшей сумме возможна доплата за доставку 1 500–3 000 тенге по усмотрению Поставщика.</p>
            <p>Способ (доставка или самовывоз) и точные сроки согласуются при подтверждении заказа менеджером.</p>
          </div>
        </div>

        {/* Возврат */}
        <div className="rounded-card bg-white p-8 shadow-sm sm:p-10">
          <h2 className="text-xl font-black">Возврат</h2>
          <div className="mt-5 space-y-3 text-sm leading-7 text-dark/80">
            <p>
              Продукция скоропортящаяся. Товар надлежащего качества возврату не подлежит.
            </p>
            <p>
              Претензии по количеству и качеству принимаются только в момент приёмки и фиксируются актом.
              После подписания накладной претензии не рассматриваются.
            </p>
            <p>
              При выявлении производственного брака Поставщик производит замену, допоставку или возврат стоимости.
            </p>
            <p>
              Возврат средств по оплате картой — на ту же карту в срок до 10 рабочих дней с момента согласования возврата.
            </p>
            <p>
              Подробнее —{" "}
              <Link href="/oferta" className="font-bold text-coral hover:underline">
                разделы 8–9 Публичной оферты
              </Link>
              . По вопросам: e-mail{" "}
              <a href="mailto:info@dc-bakery.kz" className="font-bold text-coral hover:underline">
                info@dc-bakery.kz
              </a>
              , тел.{" "}
              <a href="tel:+77477272650" className="font-bold text-coral hover:underline">
                +7 747 727 2650
              </a>
              .
            </p>
          </div>
        </div>

      </div>
    </main>
  );
}
