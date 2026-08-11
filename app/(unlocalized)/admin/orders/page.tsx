import type { Metadata } from "next";
import Link from "next/link";
import { statusLabels } from "@/src/components/admin/OrderStatusBadge";
import { OrderSlaStatus } from "@/src/components/admin/OrderSlaStatus";
import { PaymentStatusBadge } from "@/src/components/admin/PaymentStatusBadge";
import { orderTotalWithDelivery } from "@/app/constants";
import { fetchAdminOrdersPage } from "@/src/lib/supabase/admin";
import { formatPrice } from "@/src/lib/format";
import { canonicalOrderStatuses } from "@/src/lib/order-status";
import type { OrderStatus } from "@/src/types";

type AdminOrdersPageProps = {
  searchParams: Promise<{
    status?: string | string[];
    q?: string | string[];
    page?: string | string[];
  }>;
};

const PAGE_SIZE = 50;

function firstParam(value: string | string[] | undefined) {
  return (Array.isArray(value) ? value[0] : value) ?? "";
}

function ordersHref(opts: { status?: OrderStatus; q?: string; page?: number }) {
  const params = new URLSearchParams();
  if (opts.status) params.set("status", opts.status);
  if (opts.q) params.set("q", opts.q);
  if (opts.page && opts.page > 1) params.set("page", String(opts.page));
  const qs = params.toString();
  return qs ? `/admin/orders?${qs}` : "/admin/orders";
}

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
  const { status, q, page } = await searchParams;
  const selectedStatus = getSelectedStatus(status);
  const search = firstParam(q).trim();
  const currentPage = Math.max(1, Number(firstParam(page)) || 1);
  const { orders, hasNext } = await fetchAdminOrdersPage({
    status: selectedStatus,
    search: search || undefined,
    limit: PAGE_SIZE,
    offset: (currentPage - 1) * PAGE_SIZE,
  });

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[.15em] text-muted">Админка</p>
          <h1 className="mt-2 font-display text-4xl font-semibold tracking-tight sm:text-5xl">Заказы</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-muted">
            Все заявки с сайта и из WhatsApp, свежие сверху.
          </p>
        </div>
        <Link
          href="/admin/orders/new"
          className="shrink-0 rounded border border-coral bg-coral px-4 py-2.5 text-sm font-bold text-white transition hover:bg-coral-hover"
        >
          + Заявка от клиента
        </Link>
      </div>

      <form method="get" action="/admin/orders" className="mt-6 flex flex-wrap gap-2">
        {selectedStatus ? <input type="hidden" name="status" value={selectedStatus} /> : null}
        <input
          type="search"
          name="q"
          defaultValue={search}
          placeholder="Поиск: номер, компания, имя, телефон"
          className="min-w-[220px] flex-1 rounded-btn border border-black/15 bg-white px-4 py-2 text-sm text-dark outline-none focus:border-coral"
        />
        <button type="submit" className="rounded-btn border border-dark bg-dark px-4 py-2 text-sm font-semibold text-white transition hover:bg-dark/90">Найти</button>
        {search ? (
          <Link href={ordersHref({ status: selectedStatus })} className="rounded-btn border border-black/15 bg-white px-4 py-2 text-sm font-semibold text-muted transition hover:bg-black/5">Сброс</Link>
        ) : null}
      </form>

      <nav className="mt-4 flex gap-2 overflow-x-auto pb-2" aria-label="Фильтр статуса">
        {statusFilters.map((filter) => {
          const isActive = filter.value === selectedStatus || (!filter.value && !selectedStatus);
          const href = ordersHref({ status: filter.value, q: search });

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
                        className="font-data font-semibold text-coral hover:text-coral-hover"
                      >
                        {order.order_number}
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-semibold text-dark">{order.company_name}</p>
                      <p className="mt-0.5 text-xs text-muted">{order.customer_name}</p>
                    </td>
                    <td className="hidden px-4 py-3 text-muted md:table-cell">{order.customer_phone}</td>
                    <td className="px-4 py-3 font-data font-semibold">{formatPrice(orderTotalWithDelivery(order))}</td>
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
            <h2 className="font-display text-xl font-semibold">
              {search || selectedStatus ? "Ничего не найдено" : "Заказов пока нет"}
            </h2>
            <p className="mt-3 text-sm text-muted">
              {search || selectedStatus
                ? "Измените запрос или сбросьте фильтр."
                : "Новые заявки появятся здесь после оформления на сайте."}
            </p>
          </div>
        )}
      </div>

      {currentPage > 1 || hasNext ? (
        <div className="mt-4 flex items-center justify-between">
          {currentPage > 1 ? (
            <Link
              href={ordersHref({ status: selectedStatus, q: search, page: currentPage - 1 })}
              className="rounded-btn border border-black/15 bg-white px-4 py-2 text-sm font-semibold text-dark transition hover:bg-black/5"
            >← Назад</Link>
          ) : (
            <span />
          )}
          <span className="text-sm text-muted">Стр. {currentPage}</span>
          {hasNext ? (
            <Link
              href={ordersHref({ status: selectedStatus, q: search, page: currentPage + 1 })}
              className="rounded-btn border border-black/15 bg-white px-4 py-2 text-sm font-semibold text-dark transition hover:bg-black/5"
            >Вперёд →</Link>
          ) : (
            <span />
          )}
        </div>
      ) : null}
    </div>
  );
}
