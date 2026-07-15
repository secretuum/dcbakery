import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Контакты и реквизиты — DC Bakery",
  description:
    "Контактная информация и банковские реквизиты DC Bakery. ИП Кошкаров А.К., г. Алматы. Телефон, e-mail, WhatsApp.",
};

export default function ContactsPage() {
  return (
    <main className="min-h-screen bg-cream px-5 py-12 text-dark lg:px-8 lg:py-16">
      <div className="mx-auto max-w-3xl space-y-6">

        {/* Контакты */}
        <div className="rounded-card border border-black/10 bg-white p-8 sm:p-10">
          <p className="text-xs font-semibold uppercase tracking-[.15em] text-muted">Поставщик</p>
          <h1 className="mt-3 font-display text-3xl font-semibold tracking-tight sm:text-4xl">Контакты и реквизиты</h1>
          <p className="mt-2 text-sm text-muted">DC Bakery — B2B-поставки хлебобулочных и кондитерских изделий</p>

          <div className="mt-8 grid gap-4 sm:grid-cols-2">
            <div className="rounded-card border border-black/5 bg-cream p-5">
              <p className="text-xs font-semibold uppercase tracking-[.08em] text-muted">Наименование</p>
              <p className="mt-2 text-sm font-semibold text-dark">ИП Кошкаров Асылбек Касымбекович</p>
            </div>
            <div className="rounded-card border border-black/5 bg-cream p-5">
              <p className="text-xs font-semibold uppercase tracking-[.08em] text-muted">БИН / ИИН</p>
              <p className="mt-2 text-sm font-semibold text-dark">810127300096</p>
            </div>
            <div className="rounded-card border border-black/5 bg-cream p-5 sm:col-span-2">
              <p className="text-xs font-semibold uppercase tracking-[.08em] text-muted">Регистрация</p>
              <p className="mt-2 text-sm font-semibold text-dark">
                Талон о госрегистрации ИП №KZ26TWQ02214961 от 26.01.2025
              </p>
            </div>
            <div className="rounded-card border border-black/5 bg-cream p-5 sm:col-span-2">
              <p className="text-xs font-semibold uppercase tracking-[.08em] text-muted">Адрес</p>
              <p className="mt-2 text-sm font-semibold text-dark">
                г. Алматы, ул. Утепова 31, блок 21, кв. 2377
              </p>
            </div>
            <div className="rounded-card border border-black/5 bg-cream p-5">
              <p className="text-xs font-semibold uppercase tracking-[.08em] text-muted">Телефон</p>
              <a
                href="tel:+77477272650"
                className="mt-2 block text-sm font-semibold text-dark hover:text-coral"
              >
                +7 747 727 2650
              </a>
            </div>
            <div className="rounded-card border border-black/5 bg-cream p-5">
              <p className="text-xs font-semibold uppercase tracking-[.08em] text-muted">WhatsApp</p>
              <a
                href="https://wa.me/77477272650"
                className="mt-2 block text-sm font-semibold text-dark hover:text-coral"
                target="_blank"
                rel="noopener noreferrer"
              >
                +7 747 727 2650
              </a>
            </div>
            <div className="rounded-card border border-black/5 bg-cream p-5">
              <p className="text-xs font-semibold uppercase tracking-[.08em] text-muted">E-mail</p>
              <a
                href="mailto:info@dc-bakery.kz"
                className="mt-2 block text-sm font-semibold text-dark hover:text-coral"
              >
                info@dc-bakery.kz
              </a>
            </div>
            <div className="rounded-card border border-black/5 bg-cream p-5">
              <p className="text-xs font-semibold uppercase tracking-[.08em] text-muted">Сайт</p>
              <p className="mt-2 text-sm font-semibold text-dark">dc-bakery.kz</p>
            </div>
            <div className="rounded-card border border-black/5 bg-cream p-5 sm:col-span-2">
              <p className="text-xs font-semibold uppercase tracking-[.08em] text-muted">Приём заказов</p>
              <p className="mt-2 text-sm font-semibold text-dark">
                Через сайт и WhatsApp-каталог
              </p>
            </div>
          </div>
        </div>

        {/* Банковские реквизиты */}
        <div className="rounded-card border border-black/10 bg-white p-8 sm:p-10">
          <p className="text-xs font-semibold uppercase tracking-[.15em] text-muted">Оплата по счёту</p>
          <h2 className="mt-3 font-display text-2xl font-semibold tracking-tight">Банковские реквизиты</h2>
          <p className="mt-2 text-sm text-muted">
            Оплата производится на счёт, соответствующий категории Продукции.{" "}
            <Link href="/oferta#section-5" className="font-bold text-coral hover:underline">
              Подробнее в п. 5.3 Оферты
            </Link>
          </p>

          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <div className="rounded-card border border-coral/20 bg-cream p-5">
              <p className="font-display font-semibold text-coral">Счёт «Пекарня»</p>
              <p className="mt-1 text-xs text-muted">десерты, выпечка, кондитерские изделия</p>
              <dl className="mt-4 space-y-2 text-sm">
                <div>
                  <dt className="text-xs font-semibold uppercase tracking-[.06em] text-muted/70">Наименование</dt>
                  <dd className="mt-0.5 font-semibold text-dark">ИП КОШКАРОВ АСЫЛБЕК КАСЫМБЕКОВИЧ</dd>
                </div>
                <div>
                  <dt className="text-xs font-semibold uppercase tracking-[.06em] text-muted/70">БИН / ИИН</dt>
                  <dd className="mt-0.5 font-semibold text-dark">810127300096</dd>
                </div>
                <div>
                  <dt className="text-xs font-semibold uppercase tracking-[.06em] text-muted/70">Банк</dt>
                  <dd className="mt-0.5 font-semibold text-dark">АО «Kaspi Bank»</dd>
                </div>
                <div>
                  <dt className="text-xs font-semibold uppercase tracking-[.06em] text-muted/70">БИК</dt>
                  <dd className="mt-0.5 font-semibold text-dark">CASPKZKA</dd>
                </div>
                <div>
                  <dt className="text-xs font-semibold uppercase tracking-[.06em] text-muted/70">КБе</dt>
                  <dd className="mt-0.5 font-semibold text-dark">19</dd>
                </div>
                <div>
                  <dt className="text-xs font-semibold uppercase tracking-[.06em] text-muted/70">IBAN</dt>
                  <dd className="mt-0.5 font-data font-semibold text-dark">KZ61722S000051248791</dd>
                </div>
              </dl>
            </div>

            <div className="rounded-card border border-coral/20 bg-cream p-5">
              <p className="font-display font-semibold text-coral">Счёт «Цех полуфабрикатов»</p>
              <p className="mt-1 text-xs text-muted">полуфабрикаты</p>
              <dl className="mt-4 space-y-2 text-sm">
                <div>
                  <dt className="text-xs font-semibold uppercase tracking-[.06em] text-muted/70">Наименование</dt>
                  <dd className="mt-0.5 font-semibold text-dark">ИП КОШКАРОВ АСЫЛБЕК КАСЫМБЕКОВИЧ</dd>
                </div>
                <div>
                  <dt className="text-xs font-semibold uppercase tracking-[.06em] text-muted/70">БИН / ИИН</dt>
                  <dd className="mt-0.5 font-semibold text-dark">810127300096</dd>
                </div>
                <div>
                  <dt className="text-xs font-semibold uppercase tracking-[.06em] text-muted/70">Банк</dt>
                  <dd className="mt-0.5 font-semibold text-dark">АО «Kaspi Bank»</dd>
                </div>
                <div>
                  <dt className="text-xs font-semibold uppercase tracking-[.06em] text-muted/70">БИК</dt>
                  <dd className="mt-0.5 font-semibold text-dark">CASPKZKA</dd>
                </div>
                <div>
                  <dt className="text-xs font-semibold uppercase tracking-[.06em] text-muted/70">КБе</dt>
                  <dd className="mt-0.5 font-semibold text-dark">19</dd>
                </div>
                <div>
                  <dt className="text-xs font-semibold uppercase tracking-[.06em] text-muted/70">IBAN</dt>
                  <dd className="mt-0.5 font-data font-semibold text-dark">KZ73722S000051742402</dd>
                </div>
              </dl>
            </div>
          </div>
        </div>

      </div>
    </main>
  );
}
