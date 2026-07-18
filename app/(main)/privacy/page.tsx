import type { Metadata } from "next";
import Link from "next/link";
import { getT } from "@/src/i18n/server";

export const metadata: Metadata = {
  title: "Политика конфиденциальности — DC Bakery",
  description:
    "Порядок обработки и защиты персональных данных пользователей сайта dc-bakery.kz. Редакция от 10 июля 2026 года.",
};

export default async function PrivacyPage() {
  const t = await getT();

  return (
    <main className="min-h-screen bg-cream px-5 py-12 text-dark lg:px-8 lg:py-16">
      <article className="mx-auto max-w-3xl">
        <div className="rounded-card border border-black/10 bg-white p-8 sm:p-10">
          <p className="text-xs font-semibold uppercase tracking-[.15em] text-muted">{t("Правовая информация")}</p>
          <h1 className="mt-3 font-display text-3xl font-semibold tracking-tight sm:text-4xl">{t("Политика конфиденциальности")}</h1>
          <p className="mt-2 text-sm text-muted">{t("обработки персональных данных — сайт dc-bakery.kz")}</p>
          <div className="mt-5 rounded-btn bg-cream px-4 py-3 text-xs font-semibold text-muted">{t("Редакция от 10 июля 2026 года.&ensp;Проект — подлежит согласованию с юристом.").replace(/&ensp;/g, " ")}</div>

          <div className="mt-10 border-t border-black/10 pt-8">
            <h2 className="font-display text-lg font-semibold">{t("1. Общие положения")}</h2>
            <div className="mt-4 space-y-3 text-sm leading-7 text-dark/80">
              <p>{t("1.1. Настоящая Политика конфиденциальности (далее — «Политика») определяет порядок обработки и защиты персональных данных пользователей сайта dc-bakery.kz (далее — «Сайт»).")}</p>
              <p>{t("1.2. Оператор персональных данных — Индивидуальный предприниматель Кошкаров Асылбек Касымбекович, ИИН/БИН 810127300096 (далее — «Оператор»). Контактные данные указаны в разделе 12.")}</p>
              <p>{t("1.3. Политика разработана в соответствии с законодательством Республики Казахстан, в том числе Законом Республики Казахстан «О персональных данных и их защите».")}</p>
              <p>{t("1.4. Используя Сайт, проходя регистрацию и/или оформляя заказ, пользователь подтверждает согласие с условиями настоящей Политики.")}</p>
            </div>
          </div>

          <div className="mt-10 border-t border-black/10 pt-8">
            <h2 className="font-display text-lg font-semibold">{t("2. Термины")}</h2>
            <div className="mt-4 space-y-3 text-sm leading-7 text-dark/80">
              <p>{t("2.1. Персональные данные — сведения, относящиеся к определённому или определяемому на их основании субъекту.")}</p>
              <p>{t("2.2. Обработка персональных данных — любое действие с персональными данными (сбор, хранение, использование, передача, обезличивание, удаление и иные действия).")}</p>
              <p>{t("2.3. Субъект — физическое лицо (в том числе представитель Покупателя), персональные данные которого обрабатываются.")}</p>
            </div>
          </div>

          <div className="mt-10 border-t border-black/10 pt-8">
            <h2 className="font-display text-lg font-semibold">{t("3. Какие данные обрабатываются")}</h2>
            <div className="mt-4 space-y-3 text-sm leading-7 text-dark/80">
              <p>{t("3.1. Оператор обрабатывает следующие данные: имя контактного лица и наименование компании (Покупателя); телефон; адрес электронной почты; адрес доставки; сведения о заказах и оплатах; технические данные (IP-адрес, файлы cookie, данные об устройстве и посещениях Сайта).")}</p>
              <p>{t("3.2. Оператор не собирает и не хранит данные банковских карт — оплата банковской картой проводится на стороне банка-эквайера (платёжного провайдера).")}</p>
            </div>
          </div>

          <div className="mt-10 border-t border-black/10 pt-8">
            <h2 className="font-display text-lg font-semibold">{t("4. Цели обработки")}</h2>
            <div className="mt-4 space-y-3 text-sm leading-7 text-dark/80">
              <p>{t("4.1. Данные обрабатываются в целях: регистрации и идентификации пользователя; оформления, подтверждения и исполнения заказов; связи с пользователем по заказу и претензиям; ведения бухгалтерского и налогового учёта и выполнения требований законодательства; улучшения работы Сайта и качества обслуживания.")}</p>
            </div>
          </div>

          <div className="mt-10 border-t border-black/10 pt-8">
            <h2 className="font-display text-lg font-semibold">{t("5. Правовое основание и согласие")}</h2>
            <div className="mt-4 space-y-3 text-sm leading-7 text-dark/80">
              <p>{t("5.1. Обработка осуществляется на основании согласия субъекта, а также в целях исполнения договора (")}<Link href="/oferta" className="font-bold text-coral hover:underline">{t("Публичной оферты")}</Link>{t(") и выполнения требований законодательства Республики Казахстан.")}</p>
              <p>{t("5.2. Согласие предоставляется субъектом при регистрации и/или оформлении заказа и может быть отозвано в порядке раздела 10.")}</p>
            </div>
          </div>

          <div className="mt-10 border-t border-black/10 pt-8">
            <h2 className="font-display text-lg font-semibold">{t("6. Файлы cookie")}</h2>
            <div className="mt-4 space-y-3 text-sm leading-7 text-dark/80">
              <p>{t("6.1. Сайт может использовать файлы cookie для обеспечения работы функций и аналитики. Пользователь может отключить cookie в настройках браузера; при этом часть функций Сайта может стать недоступной.")}</p>
            </div>
          </div>

          <div className="mt-10 border-t border-black/10 pt-8">
            <h2 className="font-display text-lg font-semibold">{t("7. Передача третьим лицам")}</h2>
            <div className="mt-4 space-y-3 text-sm leading-7 text-dark/80">
              <p>{t("7.1. Оператор передаёт персональные данные третьим лицам только в объёме, необходимом для исполнения заказа: банкам-эквайерам и платёжным провайдерам — для оплаты; сервисам обмена сообщениями и уведомлений (в том числе WhatsApp) — для связи по заказу; учётным системам (iiko, 1С) — для оформления документов и учёта; службам доставки — для доставки; хостинг- и инфраструктурным провайдерам — для функционирования Сайта.")}</p>
              <p>{t("7.2. Оператор не продаёт персональные данные третьим лицам.")}</p>
            </div>
          </div>

          <div className="mt-10 border-t border-black/10 pt-8">
            <h2 className="font-display text-lg font-semibold">{t("8. Трансграничная передача и хранение")}</h2>
            <div className="mt-4 space-y-3 text-sm leading-7 text-dark/80">
              <p>{t("8.1. Персональные данные могут обрабатываться и храниться на серверах поставщиков услуг (хостинг, электронная почта, инфраструктура), в том числе расположенных за пределами Республики Казахстан, при обеспечении необходимых мер защиты и/или на основании согласия субъекта в соответствии с законодательством Республики Казахстан.")}</p>
            </div>
          </div>

          <div className="mt-10 border-t border-black/10 pt-8">
            <h2 className="font-display text-lg font-semibold">{t("9. Сроки хранения и меры защиты")}</h2>
            <div className="mt-4 space-y-3 text-sm leading-7 text-dark/80">
              <p>{t("9.1. Персональные данные хранятся в течение срока, необходимого для достижения целей обработки и выполнения требований законодательства.")}</p>
              <p>{t("9.2. Оператор принимает организационные и технические меры для защиты персональных данных от неправомерного или случайного доступа, изменения, раскрытия или уничтожения.")}</p>
            </div>
          </div>

          <div className="mt-10 border-t border-black/10 pt-8">
            <h2 className="font-display text-lg font-semibold">{t("10. Права субъекта персональных данных")}</h2>
            <div className="mt-4 space-y-3 text-sm leading-7 text-dark/80">
              <p>{t("10.1. Субъект вправе: получать информацию об обработке своих персональных данных; требовать их уточнения, блокирования или удаления; отозвать ранее данное согласие на обработку. Обращения направляются по контактным данным, указанным в разделе 12.")}</p>
            </div>
          </div>

          <div className="mt-10 border-t border-black/10 pt-8">
            <h2 className="font-display text-lg font-semibold">{t("11. Изменение Политики")}</h2>
            <div className="mt-4 space-y-3 text-sm leading-7 text-dark/80">
              <p>{t("11.1. Оператор вправе изменять настоящую Политику. Действующая редакция размещается на Сайте и вступает в силу с момента размещения.")}</p>
            </div>
          </div>

          <div className="mt-10 border-t border-black/10 pt-8">
            <h2 className="font-display text-lg font-semibold">{t("12. Контакты Оператора")}</h2>
            <div className="mt-4 space-y-3 text-sm leading-7 text-dark/80">
              <p>{t("ИП Кошкаров Асылбек Касымбекович, ИИН/БИН 810127300096.")}</p>
              <p>{t("Адрес: г. Алматы, ул. Жамбыла 154.")}</p>
              <p>
                E-mail:{" "}
                <a href="mailto:info@dc-bakery.kz" className="font-bold text-coral hover:underline">
                  info@dc-bakery.kz
                </a>
                ; тел.:{" "}
                <a href="tel:+77477272650" className="font-bold text-coral hover:underline">
                  +7 747 727 2650
                </a>
                ,{" "}
                <a href="tel:+77476940766" className="font-bold text-coral hover:underline">
                  +7 747 694 0766
                </a>{t("; сайт: dc-bakery.kz.")}</p>
            </div>
          </div>

          <div className="mt-10 border-t border-black/10 pt-6 text-center">
            <Link href="/oferta" className="text-sm font-bold text-coral hover:underline">{t("← Публичная оферта")}</Link>
          </div>
        </div>
      </article>
    </main>
  );
}
