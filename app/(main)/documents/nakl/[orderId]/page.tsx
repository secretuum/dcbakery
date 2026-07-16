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
import { fetchAdminOrder, fetchAdminOrderItems } from "@/src/lib/supabase/admin";

type NaklPageProps = {
  params: Promise<{ orderId: string }>;
  searchParams: Promise<{ split?: string }>;
};

export const metadata: Metadata = {
  title: "Накладная | DC Bakery",
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
          <DocumentPrintButton />
        </div>

        {company.isDemo ? (
          <div className="mb-6 border-4 border-[#b91c1c] px-4 py-3 text-center text-2xl font-bold uppercase text-[#b91c1c]">
            Демо-документ
          </div>
        ) : null}

        {sections.map((section, sectionIndex) => (
          <article
            key={section.key}
            className={sectionIndex < sections.length - 1 ? "break-after-page mb-16" : ""}
          >
            <header className="border-b-2 border-dark pb-6">
              <p className="text-sm font-bold uppercase text-muted">DC Bakery</p>
              <h1 className="mt-3 text-4xl font-bold">
                Товарная накладная №{" "}
                {sections.length > 1 ? `${order.order_number}-${sectionIndex + 1}` : order.order_number}
              </h1>
              <p className="mt-2 text-sm font-semibold">
                от {formatDate(order.created_at)}
                {section.label ? ` · ${section.label}` : ""}
              </p>
            </header>

            <section className="mt-8 grid gap-4 sm:grid-cols-2">
              <div className="border border-black/15 p-4">
                <p className="text-xs font-bold uppercase text-muted">
                  Грузоотправитель / Поставщик
                </p>
                <p className="mt-2 font-bold">{company.legalName}</p>
                <p className="mt-1 text-sm">БИН: {company.bin}</p>
                <p className="mt-1 text-sm">{company.address}</p>
              </div>
              <div className="border border-black/15 p-4">
                <p className="text-xs font-bold uppercase text-muted">
                  Грузополучатель / Покупатель
                </p>
                <p className="mt-2 font-bold">{order.company_name}</p>
                <p className="mt-1 text-sm">БИН/ИП: {order.customer_bin || "не указан"}</p>
                <p className="mt-1 text-sm">{order.delivery_address || "адрес не указан"}</p>
              </div>
            </section>

            <p className="mt-5 text-sm font-semibold text-muted">
              Основание: Заявка № {order.order_number}
              {order.delivery_date
                ? `, дата поставки ${formatDate(order.delivery_date)}`
                : ""}
            </p>

            <div className="mt-4 overflow-x-auto">
              <table className="w-full min-w-[640px] border-collapse text-left text-sm">
                <thead>
                  <tr className="bg-cream">
                    <th className="border border-black/15 px-3 py-3">№</th>
                    <th className="border border-black/15 px-3 py-3">Наименование</th>
                    <th className="border border-black/15 px-3 py-3">Ед.</th>
                    <th className="border border-black/15 px-3 py-3">Кол-во</th>
                    <th className="border border-black/15 px-3 py-3">Цена</th>
                    <th className="border border-black/15 px-3 py-3">Сумма</th>
                  </tr>
                </thead>
                <tbody>
                  {section.items.map((item, index) => (
                    <tr key={item.id}>
                      <td className="border border-black/15 px-3 py-3">{index + 1}</td>
                      <td className="border border-black/15 px-3 py-3 font-bold">
                        {item.product_name}
                      </td>
                      <td className="border border-black/15 px-3 py-3">{item.unit}</td>
                      <td className="border border-black/15 px-3 py-3">{item.qty}</td>
                      <td className="border border-black/15 px-3 py-3">{formatPrice(item.price)}</td>
                      <td className="border border-black/15 px-3 py-3 font-bold">
                        {formatPrice(item.total_amount)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mt-6 ml-auto max-w-md border-t-2 border-dark pt-4 text-right">
              <p className="text-2xl font-bold">
                Итого: {formatPrice(sections.length > 1 ? sumItems(section.items) : order.total_amount)}
              </p>
              <p className="mt-2 text-sm font-bold">{company.taxNote}</p>
            </div>

            <footer className="mt-16 grid gap-8 border-t border-black/15 pt-6 text-sm sm:grid-cols-2">
              <div>
                <p className="font-bold">Отпустил (Поставщик)</p>
                <p className="mt-1 text-muted">{company.legalName}</p>
                <p className="mt-8">__________________ {company.directorName}</p>
              </div>
              <div>
                <p className="font-bold">Принял (Покупатель)</p>
                <p className="mt-1 text-muted">{order.company_name}</p>
                <p className="mt-8">__________________ {order.customer_name}</p>
              </div>
            </footer>
          </article>
        ))}
      </div>
    </main>
  );
}
