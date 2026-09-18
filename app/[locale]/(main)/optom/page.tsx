import type { Metadata } from "next";
import Link from "next/link";
import { EditableText } from "@/src/components/home/SiteEditMode";
import { JsonLd } from "@/src/components/seo/JsonLd";
import { getLocale, getT } from "@/src/i18n/server";
import { withLocale, buildAlternates } from "@/src/i18n/routing";

export async function generateMetadata(): Promise<Metadata> {
  const [t, locale] = await Promise.all([getT(), getLocale()]);
  return {
    title: t("Оптовые поставки — DC Bakery"),
    description: t(
      "DC Bakery — оптовый B2B-поставщик десертов, тортов, замороженных полуфабрикатов, мяса и банкетных десертов для кофеен, ресторанов, отелей и магазинов в Алматы. Доставка, оплата по счёту, работа с юрлицами.",
    ),
    alternates: buildAlternates("/optom", locale),
  };
}

// Ответно-ориентированная страница «Оптом»: факты вынесены короткими блоками
// с вопросными заголовками, чтобы AI-поисковики (AI Overviews, ассистенты)
// могли извлекать и цитировать. Тарифы доставки — из app/constants.ts, не выдумываем.
//
// FAQ собирается ВНУТРИ компонента уже локализованным (t()): из ОДНОГО массива
// `faq` рендерим и видимый блок, и FAQPage JSON-LD, чтобы текст схемы байт-в-байт
// совпадал с видимым на любом языке (требование schema == visible). Прозаические
// блоки редактируемы через EditableText (override живут в site_content по ключам optom.*).

export default async function OptomPage() {
  const [t, locale] = await Promise.all([getT(), getLocale()]);

  const faq: { q: string; a: string }[] = [
    {
      q: t("Есть ли минимальный заказ?"),
      a: t(
        "Да, минимальная сумма заказа — 15 000 ₸. Доставка по Алматы бесплатная на все заказы.",
      ),
    },
    {
      q: t("Куда и в какие сроки вы доставляете?"),
      a: t(
        "Доставка по Алматы. Точную дату и способ (доставка или самовывоз) менеджер согласует при подтверждении заказа. Приём заявок — накануне дня доставки.",
      ),
    },
    {
      q: t("Какие условия для кафе, ресторанов и отелей?"),
      a: t(
        "Работаем с HoReCa и магазинами по оптовым ценам. После регистрации на сайте и подтверждения менеджером вы получаете доступ к каталогу с оптовыми ценами, живыми остатками и историей заказов в личном кабинете.",
      ),
    },
    {
      q: t("Возможна ли отсрочка платежа или консигнация?"),
      a: t(
        "Отсрочка платежа и консигнация возможны по согласованию с менеджером — конкретные условия обсуждаются индивидуально и зависят от объёма и истории сотрудничества. Для новых аккаунтов первые заказы оформляются по предоплате.",
      ),
    },
    {
      q: t("Каковы сроки и температура хранения полуфабрикатов?"),
      a: t(
        "Замороженные полуфабрикаты (пельмени, манты, самса, чебуреки, сырники, вареники) поставляются и хранятся в заморозке при температуре не выше −18 °C. Точные сроки годности указаны на упаковке каждой позиции.",
      ),
    },
    {
      q: t("Ваша продукция халал?"),
      a: t(
        "Мясо поставляется с халал-сертификатами. Точный статус и маркировку по конкретной позиции уточняйте у менеджера — они зависят от товара и цеха-изготовителя.",
      ),
    },
    {
      q: t("Работаете ли вы с юридическими лицами по счёту?"),
      a: t(
        "Да. Для юрлиц и ИП работаем по безналичному расчёту: выставляем счёт, оплата производится на банковский счёт поставщика. Реквизиты и способы оплаты — на странице «Контакты и реквизиты».",
      ),
    },
  ];

  // FAQPage строится из того же массива, что и видимый блок ниже — совпадение гарантировано.
  const faqJsonLd: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faq.map((item) => ({
      "@type": "Question",
      name: item.q,
      acceptedAnswer: { "@type": "Answer", text: item.a },
    })),
  };

  return (
    <main className="min-h-screen bg-cream px-5 py-12 text-dark lg:px-8 lg:py-16">
      <JsonLd data={faqJsonLd} />
      <div className="mx-auto max-w-3xl space-y-6">

        {/* Лид — один извлекаемый факт «кто/что/где» первым абзацем */}
        <div className="rounded-card border border-black/10 bg-white p-8 sm:p-10">
          <p className="text-xs font-semibold uppercase tracking-[.15em] text-muted">{t("Оптовые поставки B2B")}</p>
          <h1 className="mt-3 font-display text-3xl font-semibold tracking-tight sm:text-4xl">{t("Оптовые поставки для вашего бизнеса")}</h1>
          <p className="mt-4 text-base leading-7 text-dark/80">
            <EditableText
              field="optom.lead"
              multiline
              fallback={t(
                "DC Bakery — оптовый B2B-поставщик десертов и тортов, замороженных полуфабрикатов (пельмени, манты, самса, чебуреки, сырники, вареники), мяса и банкетных десертов для кофеен, ресторанов, отелей и магазинов в Алматы.",
              )}
            />
          </p>
          <p className="mt-4 text-sm text-muted">
            {t("Оптовые цены, живые остатки и история заказов — в личном кабинете.")}{" "}
            <Link href={withLocale("/profile", locale)} className="font-bold text-coral hover:underline">{t("Стать партнёром →")}</Link>
          </p>
        </div>

        {/* Что поставляем */}
        <div className="rounded-card border border-black/10 bg-white p-8 sm:p-10">
          <h2 className="font-display text-xl font-semibold">{t("Что поставляем?")}</h2>
          <p className="mt-4 text-sm leading-7 text-dark/80">
            <EditableText
              field="optom.supply"
              multiline
              fallback={t(
                "Десерты и торты, замороженные полуфабрикаты (пельмени, манты, самса, чебуреки, сырники, вареники), мясо и банкетные десерты. Полный ассортимент с оптовыми ценами и остатками — в каталоге.",
              )}
            />
          </p>
          <p className="mt-4 text-sm">
            <Link href={withLocale("/catalog", locale)} className="font-bold text-coral hover:underline">{t("Открыть каталог →")}</Link>
          </p>
        </div>

        {/* Кому */}
        <div className="rounded-card border border-black/10 bg-white p-8 sm:p-10">
          <h2 className="font-display text-xl font-semibold">{t("Кому мы поставляем?")}</h2>
          <p className="mt-4 text-sm leading-7 text-dark/80">
            <EditableText
              field="optom.audience"
              multiline
              fallback={t(
                "Кофейням, ресторанам, отелям, магазинам, пекарням и другим корпоративным клиентам (HoReCa) в Алматы. Работаем строго с бизнесом — оптом и по безналичному расчёту.",
              )}
            />
          </p>
        </div>

        {/* Доставка и тарифы — реальные пороги из constants */}
        <div className="rounded-card border border-black/10 bg-white p-8 sm:p-10">
          <h2 className="font-display text-xl font-semibold">{t("Сколько стоит доставка?")}</h2>
          <div className="mt-5 rounded-card border border-black/5 bg-cream p-6 text-center">
            <p className="font-data text-2xl font-bold text-success">{t("Бесплатно")}</p>
            <p className="mt-1 text-xs font-semibold uppercase tracking-[.08em] text-muted">{t("на любой заказ по Алматы")}</p>
          </div>
          <p className="mt-5 text-sm leading-7 text-dark/80">
            <EditableText
              field="optom.delivery"
              multiline
              fallback={t(
                "Минимальный заказ — 15 000 ₸. Доставка по Алматы бесплатная на все заказы; точную дату и способ (доставка или самовывоз) менеджер согласует при подтверждении заказа.",
              )}
            />
          </p>
          <p className="mt-3 text-sm">
            <Link href={withLocale("/oplata-i-dostavka", locale)} className="font-bold text-coral hover:underline">{t("Подробнее об оплате и доставке →")}</Link>
          </p>
        </div>

        {/* Оплата */}
        <div className="rounded-card border border-black/10 bg-white p-8 sm:p-10">
          <h2 className="font-display text-xl font-semibold">{t("Как происходит оплата?")}</h2>
          <p className="mt-4 text-sm leading-7 text-dark/80">
            <EditableText
              field="optom.payment"
              multiline
              fallback={t(
                "Оплата по счёту (безналичный расчёт) для юрлиц и ИП. Для новых аккаунтов первые заказы — по предоплате. Отсрочка платежа и консигнация — по согласованию с менеджером.",
              )}
            />
          </p>
          <p className="mt-3 text-sm">
            <Link href={withLocale("/contacts", locale)} className="font-bold text-coral hover:underline">{t("Реквизиты →")}</Link>
          </p>
        </div>

        {/* Как стать клиентом */}
        <div className="rounded-card border border-black/10 bg-white p-8 sm:p-10">
          <h2 className="font-display text-xl font-semibold">{t("Как стать клиентом?")}</h2>
          <p className="mt-4 text-sm leading-7 text-dark/80">
            <EditableText
              field="optom.join"
              multiline
              fallback={t(
                "Зарегистрируйтесь по телефону в личном кабинете и оставьте заявку. Менеджер подтвердит аккаунт и откроет доступ к оптовому каталогу с ценами и остатками. Первый заказ можно оформить сразу после подтверждения.",
              )}
            />
          </p>
          <p className="mt-5 text-sm">
            <Link
              href={withLocale("/profile", locale)}
              className="inline-flex items-center rounded-full bg-espresso px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-espresso/90"
            >
              {t("Стать партнёром")}
            </Link>
          </p>
        </div>

        {/* Частые вопросы — видимый FAQ из массива faq (совпадает с FAQPage JSON-LD) */}
        <div className="rounded-card border border-black/10 bg-white p-8 sm:p-10">
          <h2 className="font-display text-2xl font-semibold tracking-tight">{t("Частые вопросы")}</h2>
          <div className="mt-6 space-y-5">
            {faq.map((item) => (
              <div key={item.q} className="border-t border-black/10 pt-5 first:border-t-0 first:pt-0">
                <h3 className="font-display text-base font-semibold text-dark">{item.q}</h3>
                <p className="mt-2 text-sm leading-7 text-dark/80">{item.a}</p>
              </div>
            ))}
          </div>
        </div>

      </div>
    </main>
  );
}
