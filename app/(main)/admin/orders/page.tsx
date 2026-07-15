import type { Metadata } from "next";
import Link from "next/link";
import { statusLabels } from "@/src/components/admin/OrderStatusBadge";
import { OrderSlaStatus } from "@/src/components/admin/OrderSlaStatus";
import { PaymentStatusBadge } from "@/src/components/admin/PaymentStatusBadge";
import { fetchAdminOrders } from "@/src/lib/supabase/admin";
import { formatPrice } from "@/src/lib/format";
import { canonicalOrderStatuses } from "@/src/lib/order-status";
import type { OrderStatus } from "@/src/types";

type AdminOrdersPageProps = {
  searchParams: Promise<{
    status?: string | string[];
  }>;
};

const statusFilters: Array<{ label: string; value?: OrderStatus }> = [
  { label: "Все" },
  ...canonicalOrderStatuses.map((status) => ({ label: statusLabels[status], value: status })),
];

function getSelectedStatus(value: string | string[] | undefined) {
  const status = Array.isArray(value) ? value[0] : value;

  if (statusFilters.some((filter) => filter.value === status)) {
    return status as OrderStatus;
  }

  return undefined;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("ru-RU", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export const metadata: Metadata = {
  title: "Заказы | Админка DC Bakery",
};

export default async function AdminOrdersPage({ searchParams }: AdminOrdersPageProps) {
  const { status } = await searchParams;
  const selectedStatus = getSelectedStatus(status);
  const orders = await fetchAdminOrders(selectedStatus);

  return (
    <div>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[.15em] text-muted">Админка</p>
          <h1 className="mt-2 font-display text-4xl font-semibold tracking-tight sm:text-5xl">Заказы</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-muted">
            Заявки из Supabase, отсортированные по дате создания.
          </p>
        </div>
        <Link
          href="/catalog"
          className="inline-flex min-h-11 items-center justify-center rounded-btn border border-black/15 bg-white px-4 py-2 text-sm font-semibold text-dark transition hover:bg-black/5"
        >
          Открыть каталог
        </Link>
      </div>

      <nav className="mt-7 flex gap-2 overflow-x-auto pb-2" aria-label="Фильтр статуса">
        {statusFilters.map((filter) => {
          const isActive = filter.value === selectedStatus || (!filter.value && !selectedStatus);
          const href = filter.value ? `/admin/orders?status=${filter.value}` : "/admin/orders";

          return (
            <Link
              key={filter.value ?? "all"}
              href={href}
              className={`shrink-0 rounded-btn border px-4 py-2 text-sm font-semibold transition ${
                isActive
                  ? "border-dark bg-dark text-white"
                  : "border-black/10 bg-white text-muted hover:bg-black/5 hover:text-dark"
              }`}
            >
              {filter.label}
            </Link>
          );
        })}
      </nav>

      <div className="mt-6 overflow-hidden rounded-card border border-black/10 bg-white">
        {orders.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="min-w-[640px] w-full border-collapse text-left">
              <thead className="border-b border-black/10 bg-cream text-xs font-semibold uppercase tracking-[.06em] text-muted">
                <tr>
                  <th className="px-4 py-3">Номер</th>
                  <th className="px-4 py-3">Компания</th>
                  <th className="hidden px-4 py-3 md:table-cell">Телефон</th>
                  <th className="px-4 py-3">Сумма</th>
                  <th className="px-4 py-3">Статус</th>
                  <th className="px-4 py-3">Оплата</th>
                  <th className="hidden px-4 py-3 md:table-cell">Дата</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black/8 text-sm font-semibold">
                {orders.map((order) => (
                  <tr key={order.id} className="transition hover:bg-black/2">
                    <td className="px-4 py-3">
                      <Link
                        href={`/admin/orders/${order.id}`}
                        className="font-data font-bold text-coral hover:text-coral-hover"
                      >
                        {order.order_number}
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-semibold text-dark">{order.company_name}</p>
                      <p className="mt-0.5 text-xs text-muted">{order.customer_name}</p>
                    </td>
                    <td className="hidden px-4 py-3 text-muted md:table-cell">{order.customer_phone}</td>
                    <td className="px-4 py-3 font-data font-semibold">{formatPrice(order.total_amount)}</td>
                    <td className="px-4 py-3">
                      <OrderSlaStatus createdAt={order.created_at} status={order.status} />
                    </td>
                    <td className="px-4 py-3">
                      <PaymentStatusBadge status={order.payment_status} />
                    </td>
                    <td className="hidden px-4 py-3 text-muted md:table-cell">{formatDate(order.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-8 text-center">
            <h2 className="font-display text-xl font-semibold">Заказов пока нет</h2>
            <p className="mt-3 text-sm text-muted">
              Новые заявки появятся здесь после оформления на сайте.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
