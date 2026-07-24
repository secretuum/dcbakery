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
import { pluralRu, quantityInWords, tengeInWords } from "@/src/lib/number-to-words";
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
  const kbe = process.env.DC_KBE?.trim() || "";
  const knp = process.env.DC_KNP?.trim() || "";

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

  // Срок действия счёта: от даты подтверждения, DC_INVOICE_VALID_DAYS дней (по умолчанию 5)
  const validDaysRaw = Number(process.env.DC_INVOICE_VALID_DAYS);
  const validDays =
    Number.isInteger(validDaysRaw) && validDaysRaw > 0 && validDaysRaw <= 60 ? validDaysRaw : 5;
  const invoiceValidUntil = (() => {
    const date = new Date(order.confirmed_at ?? order.created_at);
    date.setDate(date.getDate() + validDays);
    return date.toISOString();
  })();

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
          <a
            className="inline-flex min-h-10 items-center justify-center rounded-btn border border-coral bg-coral px-4 py-2 text-sm font-bold text-white transition hover:bg-coral-hover"
            href={`/documents/invoice/${order.id}/xlsx`}
          >
            Скачать Excel
          </a>
          <DocumentPrintButton />
        </div>

        {company.isDemo ? (
          <div className="mb-6 border-4 border-[#b91c1c] px-4 py-3 text-center text-2xl font-bold uppercase text-[#b91c1c]">
            Демо-документ. Не оплачивать
          </div>
        ) : null}

        {invoices.map((invoice, invoiceIndex) => {
          const itemCount = invoice.items.length;
          const countWords = `${quantityInWords(itemCount)} ${pluralRu(itemCount, [
            "наименование",
            "наименования",
            "наименований",
          ])}`;

          return (
            <article
              key={invoice.key}
              className={invoiceIndex < invoices.length - 1 ? "break-after-page mb-16" : ""}
            >
              <p className="text-xs italic leading-5 text-muted">
                Внимание! Оплата счёта означает согласие с условиями поставки (публичная оферта
                dc-bakery.kz/oferta).
              </p>

              {/* Реквизитная шапка бенефициара */}
              <div className="mt-3 grid grid-cols-1 border border-black/40 text-sm sm:grid-cols-2">
                <div className="border-b border-black/40 p-3 sm:border-r">
                  <p className="text-[11px] font-bold uppercase text-muted">Бенефициар</p>
                  <p className="mt-1 font-bold">{company.legalName}</p>
                  <p>БИН: {company.bin}</p>
                </div>
                <div className="border-b border-black/40 p-3">
                  <p className="text-[11px] font-bold uppercase text-muted">
                    ИИК (IBAN){invoices.length > 1 ? ` — «${invoice.label}»` : ""}
                  </p>
                  <p className="mt-1 font-bold">{invoice.iban}</p>
                </div>
                <div className="border-black/40 p-3 sm:border-r">
                  <p className="text-[11px] font-bold uppercase text-muted">Банк бенефициара</p>
                  <p className="mt-1">{company.bankName}</p>
                </div>
                <div className="p-3">
                  <p className="text-[11px] font-bold uppercase text-muted">БИК</p>
                  <p className="mt-1">
                    {company.bankBic}
                    {kbe ? ` · Кбе ${kbe}` : ""}
                    {knp ? ` · КНП ${knp}` : ""}
                  </p>
                </div>
              </div>

              <header className="mt-6 border-b-2 border-dark pb-4 text-center">
                <h1 className="text-3xl font-bold">Счёт на оплату № {invoice.number}</h1>
                <p className="mt-2 text-sm font-semibold">
                  от {formatDate(order.confirmed_at ?? order.created_at)}
                  {invoices.length > 1 ? ` · ${invoice.label}` : ""}
                </p>
              </header>

              <section className="mt-5 space-y-2 text-sm">
                <p>
                  <span className="font-bold">Поставщик: </span>
                  {company.legalName}, БИН {company.bin}, {company.address}
                </p>
                <p>
                  <span className="font-bold">Покупатель: </span>
                  {order.company_name}, БИН/ИИН {order.customer_bin || "не указан"},{" "}
                  {order.delivery_address || "адрес не указан"}
                </p>
                <p>
                  <span className="font-bold">Основание: </span>
                  Заявка № {order.order_number}
                  {order.delivery_date ? `, дата поставки ${formatDate(order.delivery_date)}` : ""}
                </p>
              </section>

              <div className="mt-4 overflow-x-auto">
                <table className="w-full min-w-[720px] border-collapse text-left text-sm">
                  <thead>
                    <tr className="bg-cream">
                      <th className="border border-black/40 px-2 py-2 text-center">№</th>
                      <th className="border border-black/40 px-2 py-2">Наименование</th>
                      <th className="border border-black/40 px-2 py-2 text-center">Ед. изм.</th>
                      <th className="border border-black/40 px-2 py-2 text-center">Кол-во</th>
                      <th className="border border-black/40 px-2 py-2 text-right">Цена, ₸</th>
                      <th className="border border-black/40 px-2 py-2 text-right">Сумма, ₸</th>
                    </tr>
                  </thead>
                  <tbody>
                    {invoice.items.map((item, index) => (
                      <tr key={item.id}>
                        <td className="border border-black/40 px-2 py-2 text-center">{index + 1}</td>
                        <td className="border border-black/40 px-2 py-2 font-semibold">
                          {item.product_name}
                        </td>
                        <td className="border border-black/40 px-2 py-2 text-center">{item.unit}</td>
                        <td className="border border-black/40 px-2 py-2 text-center">{item.qty}</td>
                        <td className="border border-black/40 px-2 py-2 text-right">
                          {formatPrice(item.price)}
                        </td>
                        <td className="border border-black/40 px-2 py-2 text-right font-semibold">
                          {formatPrice(item.total_amount)}
                        </td>
                      </tr>
                    ))}
                    <tr className="bg-cream font-bold">
                      <td className="border border-black/40 px-2 py-2 text-right" colSpan={5}>
                        Итого к оплате
                      </td>
                      <td className="border border-black/40 px-2 py-2 text-right">
                        {formatPrice(invoice.totalAmount)}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <div className="mt-5 space-y-1 text-sm">
                <p>Всего наименований: {itemCount} ({countWords}).</p>
                <p>
                  <span className="font-bold">На сумму прописью: </span>
                  {tengeInWords(invoice.totalAmount)}
                </p>
                <p className="font-semibold">{company.taxNote}</p>
                <p className="font-bold">Счёт действителен до {formatDate(invoiceValidUntil)}.</p>
              </div>

              <footer className="mt-12 grid gap-8 border-t border-black/15 pt-6 text-sm sm:grid-cols-2">
                <div>
                  <p className="font-bold">Исполнитель</p>
                  <p className="mt-8">Руководитель __________________ {company.directorName}</p>
                </div>
                <div className="sm:text-right">
                  <p className="font-bold">М.П.</p>
                </div>
              </footer>
            </article>
          );
        })}
      </div>
    </main>
  );
}
