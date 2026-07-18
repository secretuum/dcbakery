import type { Metadata } from "next";
import Link from "next/link";
import { InstagramIcon, WhatsAppIcon } from "@/src/components/ui/BrandIcons";
import { getSiteContent } from "@/src/lib/site-content";
import { getT } from "@/src/i18n/server";

export const metadata: Metadata = {
  title: "Контакты и реквизиты — DC Bakery",
  description:
    "Контактная информация и банковские реквизиты DC Bakery. ИП Кошкаров А.К., г. Алматы. Телефон, e-mail, WhatsApp.",
};

export default async function ContactsPage() {
  const content = await getSiteContent();
  const t = await getT();
  const whatsappDigits = content.contactWhatsapp.replace(/\D/g, "");
  const phoneDigits = content.contactPhone.replace(/\D/g, "");
  return (
    <main className="min-h-screen bg-cream px-5 py-12 text-dark lg:px-8 lg:py-16">
      <div className="mx-auto max-w-3xl space-y-6">

        {/* Контакты */}
        <div className="rounded-card border border-black/10 bg-white p-8 sm:p-10">
          <p className="text-xs font-semibold uppercase tracking-[.15em] text-muted">{t("Поставщик")}</p>
          <h1 className="mt-3 font-display text-3xl font-semibold tracking-tight sm:text-4xl">{t("Контакты и реквизиты")}</h1>
          <p className="mt-2 text-sm text-muted">{t("DC Bakery — B2B-поставки хлебобулочных и кондитерских изделий")}</p>

          <div className="mt-8 grid gap-4 sm:grid-cols-2">
            <div className="rounded-card border border-black/5 bg-cream p-5">
              <p className="text-xs font-semibold uppercase tracking-[.08em] text-muted">{t("Наименование")}</p>
              <p className="mt-2 text-sm font-semibold text-dark">{t("ИП Кошкаров Асылбек Касымбекович")}</p>
            </div>
            <div className="rounded-card border border-black/5 bg-cream p-5">
              <p className="text-xs font-semibold uppercase tracking-[.08em] text-muted">{t("БИН / ИИН")}</p>
              <p className="mt-2 text-sm font-semibold text-dark">810127300096</p>
            </div>
            <div className="rounded-card border border-black/5 bg-cream p-5 sm:col-span-2">
              <p className="text-xs font-semibold uppercase tracking-[.08em] text-muted">{t("Регистрация")}</p>
              <p className="mt-2 text-sm font-semibold text-dark">{t("Талон о госрегистрации ИП №KZ26TWQ02214961 от 26.01.2025")}</p>
            </div>
            <div className="rounded-card border border-black/5 bg-cream p-5 sm:col-span-2">
              <p className="text-xs font-semibold uppercase tracking-[.08em] text-muted">{t("Адрес")}</p>
              <p className="mt-2 text-sm font-semibold text-dark">
                {content.address}
              </p>
            </div>
            <div className="rounded-card border border-black/5 bg-cream p-5">
              <p className="text-xs font-semibold uppercase tracking-[.08em] text-muted">{t("Телефон / WhatsApp")}</p>
              <a
                href={`https://wa.me/${whatsappDigits}`}
                className="mt-2 flex items-center gap-2 text-sm font-semibold text-dark hover:text-coral"
                target="_blank"
                rel="noopener noreferrer"
              >
                <WhatsAppIcon className="h-4 w-4 shrink-0 text-coral" />
                {content.contactWhatsapp}
              </a>
              <a
                href={`tel:+${phoneDigits}`}
                className="mt-2 flex items-center gap-2 text-sm font-semibold text-dark hover:text-coral"
              >
                <WhatsAppIcon className="h-4 w-4 shrink-0 text-coral" />
                {content.contactPhone}
              </a>
            </div>
            <div className="rounded-card border border-black/5 bg-cream p-5">
              <p className="text-xs font-semibold uppercase tracking-[.08em] text-muted">Instagram</p>
              <a
                href="https://www.instagram.com/bakery.dc"
                className="mt-2 flex items-center gap-2 text-sm font-semibold text-dark hover:text-coral"
                target="_blank"
                rel="noopener noreferrer"
              >
                <InstagramIcon className="h-4 w-4 shrink-0 text-coral" />
                @bakery.dc
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
              <p className="text-xs font-semibold uppercase tracking-[.08em] text-muted">{t("Сайт")}</p>
              <p className="mt-2 text-sm font-semibold text-dark">dc-bakery.kz</p>
            </div>
            <div className="rounded-card border border-black/5 bg-cream p-5 sm:col-span-2">
              <p className="text-xs font-semibold uppercase tracking-[.08em] text-muted">{t("Приём заказов")}</p>
              <p className="mt-2 text-sm font-semibold text-dark">{t("Через сайт и WhatsApp-каталог")}</p>
            </div>
          </div>
        </div>

        {/* Банковские реквизиты */}
        <div className="rounded-card border border-black/10 bg-white p-8 sm:p-10">
          <p className="text-xs font-semibold uppercase tracking-[.15em] text-muted">{t("Оплата по счёту")}</p>
          <h2 className="mt-3 font-display text-2xl font-semibold tracking-tight">{t("Банковские реквизиты")}</h2>
          <p className="mt-2 text-sm text-muted">
            Оплата производится на счёт, соответствующий категории Продукции.{" "}
            <Link href="/oferta#section-5" className="font-bold text-coral hover:underline">{t("Подробнее в п. 5.3 Оферты")}</Link>
          </p>

          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <div className="rounded-card border border-coral/20 bg-cream p-5">
              <p className="font-display font-semibold text-coral">{t("Счёт «Пекарня»")}</p>
              <p className="mt-1 text-xs text-muted">{t("десерты, выпечка, кондитерские изделия")}</p>
              <dl className="mt-4 space-y-2 text-sm">
                <div>
                  <dt className="text-xs font-semibold uppercase tracking-[.06em] text-muted/70">{t("Наименование")}</dt>
                  <dd className="mt-0.5 font-semibold text-dark">{t("ИП КОШКАРОВ АСЫЛБЕК КАСЫМБЕКОВИЧ")}</dd>
                </div>
                <div>
                  <dt className="text-xs font-semibold uppercase tracking-[.06em] text-muted/70">{t("БИН / ИИН")}</dt>
                  <dd className="mt-0.5 font-semibold text-dark">810127300096</dd>
                </div>
                <div>
                  <dt className="text-xs font-semibold uppercase tracking-[.06em] text-muted/70">{t("Банк")}</dt>
                  <dd className="mt-0.5 font-semibold text-dark">{t("АО «Kaspi Bank»")}</dd>
                </div>
                <div>
                  <dt className="text-xs font-semibold uppercase tracking-[.06em] text-muted/70">{t("БИК")}</dt>
                  <dd className="mt-0.5 font-semibold text-dark">CASPKZKA</dd>
                </div>
                <div>
                  <dt className="text-xs font-semibold uppercase tracking-[.06em] text-muted/70">{t("КБе")}</dt>
                  <dd className="mt-0.5 font-semibold text-dark">19</dd>
                </div>
                <div>
                  <dt className="text-xs font-semibold uppercase tracking-[.06em] text-muted/70">IBAN</dt>
                  <dd className="mt-0.5 font-data font-semibold text-dark">KZ61722S000051248791</dd>
                </div>
              </dl>
            </div>

            <div className="rounded-card border border-coral/20 bg-cream p-5">
              <p className="font-display font-semibold text-coral">{t("Счёт «Цех полуфабрикатов»")}</p>
              <p className="mt-1 text-xs text-muted">{t("полуфабрикаты")}</p>
              <dl className="mt-4 space-y-2 text-sm">
                <div>
                  <dt className="text-xs font-semibold uppercase tracking-[.06em] text-muted/70">{t("Наименование")}</dt>
                  <dd className="mt-0.5 font-semibold text-dark">{t("ИП КОШКАРОВ АСЫЛБЕК КАСЫМБЕКОВИЧ")}</dd>
                </div>
                <div>
                  <dt className="text-xs font-semibold uppercase tracking-[.06em] text-muted/70">{t("БИН / ИИН")}</dt>
                  <dd className="mt-0.5 font-semibold text-dark">810127300096</dd>
                </div>
                <div>
                  <dt className="text-xs font-semibold uppercase tracking-[.06em] text-muted/70">{t("Банк")}</dt>
                  <dd className="mt-0.5 font-semibold text-dark">{t("АО «Kaspi Bank»")}</dd>
                </div>
                <div>
                  <dt className="text-xs font-semibold uppercase tracking-[.06em] text-muted/70">{t("БИК")}</dt>
                  <dd className="mt-0.5 font-semibold text-dark">CASPKZKA</dd>
                </div>
                <div>
                  <dt className="text-xs font-semibold uppercase tracking-[.06em] text-muted/70">{t("КБе")}</dt>
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
