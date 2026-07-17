import type { Metadata } from "next";
import Link from "next/link";
import { OrderStatusBadge } from "@/src/components/admin/OrderStatusBadge";
import { fetchAdminOrders } from "@/src/lib/supabase/admin";
import { formatPrice } from "@/src/lib/format";

export const metadata: Metadata = {
  title: "Накладные и счета | Админка DC Bakery",
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat("ru-RU", { dateStyle: "medium" }).format(new Date(value));
}

// Документы существуют для любого заказа, но реальный смысл имеют после подтверждения —
// показываем всё, кроме отменённых, свежие сверху.
const HIDDEN_STATUSES = new Set(["canceled", "cancelled"]);

export default async function AdminDocumentsPage() {
  const orders = (await fetchAdminOrders()).filter(
    (order) => !HIDDEN_STATUSES.has(order.status),
  );

  return (
    <div>
      <div>
        <p className="text-xs font-semibold uppercase tracking-[.15em] text-muted">Админка</p>
        <h1 className="mt-2 font-display text-4xl font-semibold tracking-tight sm:text-5xl">
          Накладные и счета
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-muted">
          Печатные документы по каждому заказу: счёт на оплату, накладная и АВР.
          Смешанные заказы автоматически делятся на два счёта по цехам.
        </p>
      </div>

      <div className="mt-6 overflow-hidden rounded-card border border-black/10 bg-white">
        {orders.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="min-w-[720px] w-full border-collapse text-left">
              <thead className="border-b border-black/10 bg-cream text-xs font-semibold uppercase tracking-[.06em] text-muted">
                <tr>
                  <th className="px-4 py-3">Заказ</th>
                  <th className="px-4 py-3">Компания</th>
                  <th className="px-4 py-3">Сумма</th>
                  <th className="px-4 py-3">Статус</th>
                  <th className="hidden px-4 py-3 md:table-cell">Дата</th>
                  <th className="px-4 py-3">Документы</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black/8 text-sm font-semibold">
                {orders.map((order) => (
                  <tr key={order.id} className="transition hover:bg-black/2">
                    <td className="px-4 py-3">
                      <Link
                        href={`/admin/orders/${order.id}`}
                        className="font-data font-semibold text-coral hover:text-coral-hover"
                      >
                        {order.order_number}
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-semibold text-dark">{order.company_name}</p>
                    </td>
                    <td className="px-4 py-3 font-data">{formatPrice(order.total_amount)}</td>
                    <td className="px-4 py-3">
                      <OrderStatusBadge status={order.status} />
                    </td>
                    <td className="hidden px-4 py-3 text-muted md:table-cell">
                      {formatDate(order.created_at)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-2">
                        <Link
                          className="rounded-btn border border-black/15 bg-white px-3 py-1.5 text-xs font-bold text-dark transition hover:bg-black/5"
                          href={`/documents/invoice/${order.id}`}
                          target="_blank"
                        >
                          Счёт
                        </Link>
                        <Link
                          className="rounded-btn border border-black/15 bg-white px-3 py-1.5 text-xs font-bold text-dark transition hover:bg-black/5"
                          href={`/documents/nakl/${order.id}`}
                          target="_blank"
                        >
                          Накладная
                        </Link>
                        <Link
                          className="rounded-btn border border-black/15 bg-white px-3 py-1.5 text-xs font-bold text-dark transition hover:bg-black/5"
                          href={`/documents/avr/${order.id}`}
                          target="_blank"
                        >
                          АВР
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-8 text-center">
            <h2 className="font-display text-xl font-semibold">Документов пока нет</h2>
            <p className="mt-3 text-sm text-muted">
              Здесь появятся счета и накладные по заказам с сайта.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
