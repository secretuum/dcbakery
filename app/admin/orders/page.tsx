import type { Metadata } from "next";
import Link from "next/link";
import { OrderStatusBadge, statusLabels } from "@/src/components/admin/OrderStatusBadge";
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
          <p className="text-sm font-black uppercase text-raspberry">Админка</p>
          <h1 className="mt-2 text-4xl font-black tracking-tight sm:text-5xl">Заказы</h1>
          <p className="mt-3 max-w-2xl text-sm font-semibold leading-6 text-muted">
            Заявки из Supabase, отсортированные по дате создания.
          </p>
        </div>
        <Link
          href="/catalog"
          className="inline-flex min-h-11 items-center justify-center rounded-btn bg-white px-4 py-2 text-sm font-black text-muted shadow-sm transition hover:bg-coral-light hover:text-dark"
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
              className={`shrink-0 rounded-btn px-4 py-2 text-sm font-black shadow-sm transition ${
                isActive
                  ? "bg-dark text-white"
                  : "bg-white text-muted hover:bg-coral-light hover:text-dark"
              }`}
            >
              {filter.label}
            </Link>
          );
        })}
      </nav>

      <div className="mt-6 overflow-hidden rounded-card bg-white shadow-[0_18px_60px_rgba(120,51,38,0.10)]">
        {orders.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="min-w-[960px] w-full border-collapse text-left">
              <thead className="bg-coral-light text-xs font-black uppercase text-burgundy">
                <tr>
                  <th className="px-5 py-4">Номер</th>
                  <th className="px-5 py-4">Компания</th>
                  <th className="px-5 py-4">Телефон</th>
                  <th className="px-5 py-4">Сумма</th>
                  <th className="px-5 py-4">Статус</th>
                  <th className="px-5 py-4">Оплата</th>
                  <th className="px-5 py-4">Дата</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black/10 text-sm font-semibold">
                {orders.map((order) => (
                  <tr key={order.id} className="transition hover:bg-cream">
                    <td className="px-5 py-4">
                      <Link
                        href={`/admin/orders/${order.id}`}
                        className="font-black text-raspberry hover:text-burgundy"
                      >
                        {order.order_number}
                      </Link>
                    </td>
                    <td className="px-5 py-4">
                      <p className="font-black text-dark">{order.company_name}</p>
                      <p className="mt-1 text-xs text-muted">{order.customer_name}</p>
                    </td>
                    <td className="px-5 py-4 text-muted">{order.customer_phone}</td>
                    <td className="px-5 py-4 font-black">{formatPrice(order.total_amount)}</td>
                    <td className="px-5 py-4">
                      <OrderStatusBadge status={order.status} />
                    </td>
                    <td className="px-5 py-4">
                      <PaymentStatusBadge status={order.payment_status} />
                    </td>
                    <td className="px-5 py-4 text-muted">{formatDate(order.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-8 text-center">
            <h2 className="text-3xl font-black">Заказов пока нет</h2>
            <p className="mt-3 text-sm font-semibold text-muted">
              Новые заявки появятся здесь после оформления на сайте.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
