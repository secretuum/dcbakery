import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { DocumentPrintButton } from "@/src/components/documents/DocumentPrintButton";
import {
  getCompanyDetails,
  hasCompleteCompanyDetails,
} from "@/src/lib/company-details";
import { formatPrice } from "@/src/lib/format";
import { fetchAdminOrder, fetchAdminOrderItems } from "@/src/lib/supabase/admin";

type AvrPageProps = {
  params: Promise<{ orderId: string }>;
};

export const metadata: Metadata = {
  title: "АВР | DC Bakery",
};

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}

export default async function AvrPage({ params }: AvrPageProps) {
  const { orderId } = await params;

  if (!isUuid(orderId)) {
    notFound();
  }

  const [order, items] = await Promise.all([
    fetchAdminOrder(orderId),
    fetchAdminOrderItems(orderId),
  ]);

  if (!order) {
    notFound();
  }

  const company = getCompanyDetails();
  const canIssueAvr =
    order.status === "completed" &&
    hasCompleteCompanyDetails(company);

  if (!canIssueAvr) {
    return (
      <main className="min-h-screen bg-cream px-5 py-16 text-dark lg:px-8">
        <section className="mx-auto max-w-2xl rounded-card bg-white p-8 text-center shadow-sm">
          <p className="text-sm font-bold uppercase text-raspberry">АВР</p>
          <h1 className="mt-3 text-4xl font-bold">Документ пока недоступен</h1>
          <p className="mt-4 text-sm font-semibold leading-6 text-muted">
            АВР формируется после завершения заказа. Если реквизиты компании не заполнены — обратитесь к менеджеру.
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
      <article className="mx-auto max-w-5xl">
        <div className="print-hidden mb-8 flex flex-wrap items-center justify-between gap-3">
          <Link className="text-sm font-bold text-burgundy" href={`/pay/${order.id}`}>
            Вернуться к заказу
          </Link>
          <DocumentPrintButton />
        </div>

        {company.isDemo ? (
          <div className="mb-6 border-4 border-[#b91c1c] px-4 py-3 text-center text-2xl font-bold uppercase text-[#b91c1c]">
            Демо-документ
          </div>
        ) : null}

        <header className="border-b-2 border-dark pb-6 text-center">
          <h1 className="text-4xl font-bold">Акт выполненных работ</h1>
          <p className="mt-2 text-sm font-bold">№ {order.order_number}</p>
        </header>

        <section className="mt-8 grid gap-4 sm:grid-cols-2">
          <div className="border border-black/15 p-4">
            <p className="text-xs font-bold uppercase text-muted">Исполнитель</p>
            <p className="mt-2 font-bold">{company.legalName}</p>
            <p className="mt-1 text-sm">БИН: {company.bin}</p>
          </div>
          <div className="border border-black/15 p-4">
            <p className="text-xs font-bold uppercase text-muted">Заказчик</p>
            <p className="mt-2 font-bold">{order.company_name}</p>
            <p className="mt-1 text-sm">БИН/ИП: {order.customer_bin || "не указан"}</p>
          </div>
        </section>

        <div className="mt-8 overflow-x-auto">
          <table className="w-full min-w-[720px] border-collapse text-left text-sm">
            <thead>
              <tr className="bg-cream">
                <th className="border border-black/15 px-3 py-3">№</th>
                <th className="border border-black/15 px-3 py-3">Наименование</th>
                <th className="border border-black/15 px-3 py-3">Кол-во</th>
                <th className="border border-black/15 px-3 py-3">Сумма</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, index) => (
                <tr key={item.id}>
                  <td className="border border-black/15 px-3 py-3">{index + 1}</td>
                  <td className="border border-black/15 px-3 py-3 font-bold">
                    {item.product_name}
                  </td>
                  <td className="border border-black/15 px-3 py-3">
                    {item.qty} {item.unit}
                  </td>
                  <td className="border border-black/15 px-3 py-3 font-bold">
                    {formatPrice(item.total_amount)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <p className="mt-6 text-right text-2xl font-bold">
          Всего: {formatPrice(order.total_amount)}
        </p>
        <p className="mt-2 text-right text-sm font-bold">{company.taxNote}</p>

        <footer className="mt-16 grid gap-8 border-t border-black/15 pt-6 text-sm sm:grid-cols-2">
          <div>
            <p className="font-bold">Исполнитель</p>
            <p className="mt-8">__________________ {company.directorName}</p>
          </div>
          <div>
            <p className="font-bold">Заказчик</p>
            <p className="mt-8">__________________ {order.customer_name}</p>
          </div>
        </footer>
      </article>
    </main>
  );
}
