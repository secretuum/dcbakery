import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { DocumentPrintButton } from "@/src/components/documents/DocumentPrintButton";
import {
  getCompanyDetails,
  hasCompleteCompanyDetails,
} from "@/src/lib/company-details";
import { accountGroupLabels, splitItemsByAccount, sumItems } from "@/src/lib/document-split";
import { fetchAdminProducts } from "@/src/lib/catalog";
import { formatPrice } from "@/src/lib/format";
import { nomenclatureCode } from "@/src/data/nomenclature-1c";
import { pluralRu, quantityInWords, tengeInWords } from "@/src/lib/number-to-words";
import { fetchAdminOrder, fetchAdminOrderItems } from "@/src/lib/supabase/admin";

type NaklPageProps = {
  params: Promise<{ orderId: string }>;
  searchParams: Promise<{ split?: string }>;
};

export const metadata: Metadata = {
  title: "Накладная (форма З-2) | DC Bakery",
};

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("ru-RU", { dateStyle: "long" }).format(new Date(value));
}

export default async function NaklPage({ params, searchParams }: NaklPageProps) {
  const [{ orderId }, { split }] = await Promise.all([params, searchParams]);

  if (!isUuid(orderId)) {
    notFound();
  }

  const [order, items, products] = await Promise.all([
    fetchAdminOrder(orderId),
    fetchAdminOrderItems(orderId),
    fetchAdminProducts(),
  ]);

  if (!order) {
    notFound();
  }

  const company = getCompanyDetails();
  // Форма З-2: подписанты. «Ответственный за поставку» и «Главный бухгалтер» —
  // через env, с откатом на руководителя (у ИП обычно один человек).
  const otpuskRazreshil = company.directorName;
  const chiefAccountant = process.env.DC_CHIEF_ACCOUNTANT?.trim() || "";
  const supplyResponsible = process.env.DC_SUPPLY_RESPONSIBLE?.trim() || company.directorName;

  // Разделение накладной по цехам — доступно, когда в заказе продукция обоих
  const groups = splitItemsByAccount(items, products);
  const canSplit = groups.bakery.length > 0 && groups.pf.length > 0;
  const isSplit = split === "1" && canSplit;
  const sections = isSplit
    ? ([
        { key: "bakery", label: accountGroupLabels.bakery, items: groups.bakery },
        { key: "pf", label: accountGroupLabels.pf, items: groups.pf },
      ] as const)
    : ([{ key: "all", label: null, items }] as const);
  const canIssue =
    hasCompleteCompanyDetails(company) &&
    !["pending_manager_confirmation", "new", "change_proposed", "canceled", "cancelled"].includes(
      order.status,
    );

  if (!canIssue) {
    return (
      <main className="min-h-screen bg-cream px-5 py-16 text-dark lg:px-8">
        <section className="mx-auto max-w-2xl rounded-card bg-white p-8 text-center shadow-sm">
          <p className="text-sm font-bold uppercase text-raspberry">Накладная</p>
          <h1 className="mt-3 text-4xl font-bold">Документ пока недоступен</h1>
          <p className="mt-4 text-sm font-semibold leading-6 text-muted">
            Накладная формируется после подтверждения заявки менеджером.
          </p>
          <Link className="mt-6 inline-flex font-bold text-burgundy" href={`/pay/${order.id}`}>
            Вернуться к заказу
          </Link>
        </section>
      </main>
    );
  }

  return (
    <main className="document-page bg-white px-5 py-10 text-dark lg:px-8">
      <div className="mx-auto max-w-5xl">
        <div className="print-hidden mb-8 flex flex-wrap items-center justify-between gap-3">
          <Link className="text-sm font-bold text-burgundy" href={`/pay/${order.id}`}>
            Вернуться к заказу
          </Link>
          {canSplit ? (
            <Link
              className="inline-flex min-h-10 items-center justify-center rounded-btn border border-black/15 bg-white px-4 py-2 text-sm font-semibold text-dark transition hover:bg-black/5"
              href={
                isSplit
                  ? `/documents/nakl/${order.id}`
                  : `/documents/nakl/${order.id}?split=1`
              }
            >
              {isSplit ? "Одна накладная" : "Разделить: Пекарня + Полуфабрикаты"}
            </Link>
          ) : null}
          <a
            className="inline-flex min-h-10 items-center justify-center rounded-btn border border-coral bg-coral px-4 py-2 text-sm font-bold text-white transition hover:bg-coral-hover"
            href={`/documents/nakl/${order.id}/xlsx${isSplit ? "?split=1" : ""}`}
          >
            Скачать Excel
          </a>
          <DocumentPrintButton />
        </div>

        {company.isDemo ? (
          <div className="mb-6 border-4 border-[#b91c1c] px-4 py-3 text-center text-2xl font-bold uppercase text-[#b91c1c]">
            Демо-документ
          </div>
        ) : null}

        {sections.map((section, sectionIndex) => {
          const sectionSum =
            sections.length > 1 ? sumItems(section.items) : order.total_amount;
          const itemCount = section.items.length;
          const countWords = `${quantityInWords(itemCount)} ${pluralRu(itemCount, [
            "наименование",
            "наименования",
            "наименований",
          ])}`;
          const naklNumber =
            sections.length > 1 ? `${order.order_number}-${sectionIndex + 1}` : order.order_number;

          return (
            <article
              key={section.key}
              className={sectionIndex < sections.length - 1 ? "break-after-page mb-16" : ""}
            >
              <div className="flex justify-end">
                <div className="max-w-[260px] border border-black/40 px-3 py-2 text-right text-[11px] leading-tight text-muted">
                  Форма З-2
                  <br />
                  Утверждена приказом Министра финансов
                  <br />
                  Республики Казахстан от 20.12.2012 № 562
                </div>
              </div>

              <header className="mt-3 border-b-2 border-dark pb-5 text-center">
                <h1 className="text-3xl font-bold">
                  Накладная № {naklNumber} на отпуск запасов на сторону
                </h1>
                <p className="mt-2 text-sm font-semibold">
                  от {formatDate(order.created_at)}
                  {section.label ? ` · ${section.label}` : ""}
                </p>
              </header>

              <section className="mt-6 space-y-2 text-sm">
                <p>
                  <span className="font-bold">Организация (поставщик): </span>
                  {company.legalName}, БИН {company.bin}, {company.address}
                </p>
                <p>
                  <span className="font-bold">Получатель (покупатель): </span>
                  {order.company_name}, БИН/ИИН {order.customer_bin || "не указан"},{" "}
                  {order.delivery_address || "адрес не указан"}
                </p>
                <p>
                  <span className="font-bold">Ответственный за поставку: </span>
                  {supplyResponsible || "—"}
                </p>
                <p>
                  <span className="font-bold">Основание: </span>
                  Заявка № {order.order_number}
                  {order.delivery_date
                    ? `, дата поставки ${formatDate(order.delivery_date)}`
                    : ""}
                </p>
              </section>

              <div className="mt-4 overflow-x-auto">
                <table className="w-full min-w-[760px] border-collapse text-left text-sm">
                  <thead>
                    <tr className="bg-cream">
                      <th className="border border-black/40 px-2 py-2 text-center">№</th>
                      <th className="border border-black/40 px-2 py-2">
                        Наименование, характеристика (сорт, артикул)
                      </th>
                      <th className="border border-black/40 px-2 py-2 text-center">Номенкл. №</th>
                      <th className="border border-black/40 px-2 py-2 text-center">Ед. изм.</th>
                      <th className="border border-black/40 px-2 py-2 text-center">Кол-во</th>
                      <th className="border border-black/40 px-2 py-2 text-right">Цена, тг</th>
                      <th className="border border-black/40 px-2 py-2 text-right">Сумма, тг</th>
                      <th className="border border-black/40 px-2 py-2 text-right">Сумма НДС, тг</th>
                    </tr>
                  </thead>
                  <tbody>
                    {section.items.map((item, index) => (
                      <tr key={item.id}>
                        <td className="border border-black/40 px-2 py-2 text-center">{index + 1}</td>
                        <td className="border border-black/40 px-2 py-2 font-semibold">
                          {item.product_name}
                        </td>
                        <td className="border border-black/40 px-2 py-2 text-center text-muted">
                          {nomenclatureCode(item.product_id)}
                        </td>
                        <td className="border border-black/40 px-2 py-2 text-center">{item.unit}</td>
                        <td className="border border-black/40 px-2 py-2 text-center">{item.qty}</td>
                        <td className="border border-black/40 px-2 py-2 text-right">
                          {formatPrice(item.price)}
                        </td>
                        <td className="border border-black/40 px-2 py-2 text-right font-semibold">
                          {formatPrice(item.total_amount)}
                        </td>
                        <td className="border border-black/40 px-2 py-2 text-center text-muted">—</td>
                      </tr>
                    ))}
                    <tr className="bg-cream font-bold">
                      <td className="border border-black/40 px-2 py-2 text-center" colSpan={6}>
                        Итого
                      </td>
                      <td className="border border-black/40 px-2 py-2 text-right">
                        {formatPrice(sectionSum)}
                      </td>
                      <td className="border border-black/40 px-2 py-2 text-center">—</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <div className="mt-5 space-y-1 text-sm">
                <p>
                  Всего отпущено наименований: {itemCount} ({countWords}).
                </p>
                <p>
                  <span className="font-bold">На сумму прописью: </span>
                  {tengeInWords(sectionSum)}
                </p>
                <p className="font-semibold">{company.taxNote}</p>
              </div>

              <footer className="mt-12 grid gap-x-8 gap-y-10 text-sm sm:grid-cols-2">
                <div>
                  <p className="font-bold">Отпуск разрешил</p>
                  <p className="mt-8">Руководитель __________________ {otpuskRazreshil}</p>
                </div>
                <div>
                  <p className="font-bold">Главный бухгалтер</p>
                  <p className="mt-8">__________________ {chiefAccountant}</p>
                </div>
                <div>
                  <p className="font-bold">Отпустил</p>
                  <p className="mt-8">__________________ {supplyResponsible}</p>
                </div>
                <div>
                  <p className="font-bold">
                    Получил (по доверенности № ______ от ____________)
                  </p>
                  <p className="mt-8">__________________ {order.customer_name}</p>
                </div>
              </footer>
            </article>
          );
        })}
      </div>
    </main>
  );
}
