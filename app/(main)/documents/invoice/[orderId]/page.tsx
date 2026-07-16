import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { DocumentPrintButton } from "@/src/components/documents/DocumentPrintButton";
import {
  getCompanyDetails,
  hasCompleteCompanyDetails,
} from "@/src/lib/company-details";
import {
  accountGroupLabels,
  splitItemsByAccount,
  sumItems,
  type AccountGroupKey,
} from "@/src/lib/document-split";
import { fetchAdminProducts } from "@/src/lib/catalog";
import { formatPrice } from "@/src/lib/format";
import { fetchAdminOrder, fetchAdminOrderItems } from "@/src/lib/supabase/admin";

type InvoicePageProps = {
  params: Promise<{ orderId: string }>;
};

export const metadata: Metadata = {
  title: "Счет на оплату | DC Bakery",
};

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("ru-RU", { dateStyle: "long" }).format(new Date(value));
}

export default async function InvoicePage({ params }: InvoicePageProps) {
  const { orderId } = await params;

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

  // Разбиение на счета «Пекарня» / «Цех полуфабрикатов» — только если настроен второй IBAN
  const groups = splitItemsByAccount(items, products);
  const ibanByGroup: Record<AccountGroupKey, string> = {
    bakery: company.bankIban,
    pf: company.bankIbanPf,
  };
  const invoices = (
    company.bankIbanPf && groups.pf.length > 0
      ? groups.bakery.length > 0
        ? (["bakery", "pf"] as const).map((key) => ({ key, items: groups[key] }))
        : [{ key: "pf" as const, items }]
      : [{ key: "bakery" as const, items }]
  ).map((invoice, index, list) => ({
    ...invoice,
    label: accountGroupLabels[invoice.key],
    iban: ibanByGroup[invoice.key],
    number: list.length > 1 ? `${order.order_number}-${index + 1}` : order.order_number,
    totalAmount: sumItems(invoice.items),
  }));
  const canIssueInvoice =
    hasCompleteCompanyDetails(company) &&
    !["pending_manager_confirmation", "new", "change_proposed", "canceled", "cancelled"].includes(
      order.status,
    );

  if (!canIssueInvoice) {
    return (
      <main className="min-h-screen bg-cream px-5 py-16 text-dark lg:px-8">
        <section className="mx-auto max-w-2xl rounded-card bg-white p-8 text-center shadow-sm">
          <p className="text-sm font-bold uppercase text-raspberry">Счет на оплату</p>
          <h1 className="mt-3 text-4xl font-bold">Счет пока готовится</h1>
          <p className="mt-4 text-sm font-semibold leading-6 text-muted">
            Менеджер должен подтвердить заявку, а реквизиты поставщика должны быть заполнены.
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
          {invoices.length > 1 ? (
            <p className="text-sm font-semibold text-muted">
              Заказ содержит продукцию обоих цехов — сформировано два счета.
            </p>
          ) : null}
          <DocumentPrintButton />
        </div>

        {company.isDemo ? (
          <div className="mb-6 border-4 border-[#b91c1c] px-4 py-3 text-center text-2xl font-bold uppercase text-[#b91c1c]">
            Демо-документ. Не оплачивать
          </div>
        ) : null}

        {invoices.map((invoice, invoiceIndex) => (
          <article
            key={invoice.key}
            className={invoiceIndex < invoices.length - 1 ? "break-after-page mb-16" : ""}
          >
            <header className="border-b-2 border-dark pb-6">
              <p className="text-sm font-bold uppercase text-muted">DC Bakery</p>
              <h1 className="mt-3 text-4xl font-bold">Счет на оплату № {invoice.number}</h1>
              <p className="mt-2 text-sm font-semibold">
                от {formatDate(order.created_at)}
                {invoices.length > 1 ? ` · ${invoice.label}` : ""}
              </p>
            </header>

            <section className="mt-8 grid gap-4 sm:grid-cols-2">
              <div className="border border-black/15 p-4">
                <p className="text-xs font-bold uppercase text-muted">Поставщик</p>
                <p className="mt-2 font-bold">{company.legalName}</p>
                <p className="mt-1 text-sm">БИН: {company.bin}</p>
                <p className="mt-1 text-sm">{company.address}</p>
              </div>
              <div className="border border-black/15 p-4">
                <p className="text-xs font-bold uppercase text-muted">Покупатель</p>
                <p className="mt-2 font-bold">{order.company_name}</p>
                <p className="mt-1 text-sm">БИН/ИП: {order.customer_bin || "не указан"}</p>
                <p className="mt-1 text-sm">{order.delivery_address || "адрес не указан"}</p>
              </div>
            </section>

            <section className="mt-4 border border-black/15 p-4">
              <p className="text-xs font-bold uppercase text-muted">
                Банковские реквизиты{invoices.length > 1 ? ` — счёт «${invoice.label}»` : ""}
              </p>
              <p className="mt-2 text-sm">Банк: {company.bankName}</p>
              <p className="mt-1 text-sm">БИК: {company.bankBic}</p>
              <p className="mt-1 text-sm">IBAN: {invoice.iban}</p>
            </section>

            <div className="mt-8 overflow-x-auto">
              <table className="w-full min-w-[720px] border-collapse text-left text-sm">
                <thead>
                  <tr className="bg-cream">
                    <th className="border border-black/15 px-3 py-3">№</th>
                    <th className="border border-black/15 px-3 py-3">Наименование</th>
                    <th className="border border-black/15 px-3 py-3">Кол-во</th>
                    <th className="border border-black/15 px-3 py-3">Цена</th>
                    <th className="border border-black/15 px-3 py-3">Сумма</th>
                  </tr>
                </thead>
                <tbody>
                  {invoice.items.map((item, index) => (
                    <tr key={item.id}>
                      <td className="border border-black/15 px-3 py-3">{index + 1}</td>
                      <td className="border border-black/15 px-3 py-3 font-bold">
                        {item.product_name}
                      </td>
                      <td className="border border-black/15 px-3 py-3">
                        {item.qty} {item.unit}
                      </td>
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
              <p className="text-2xl font-bold">Итого: {formatPrice(invoice.totalAmount)}</p>
              <p className="mt-2 text-sm font-bold">{company.taxNote}</p>
            </div>

            <footer className="mt-16 flex justify-between gap-8 border-t border-black/15 pt-6 text-sm">
              <p>Руководитель: {company.directorName}</p>
              <p>Подпись: __________________</p>
            </footer>
          </article>
        ))}
      </div>
    </main>
  );
}
