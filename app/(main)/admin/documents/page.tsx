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

function toDateInputValue(date: Date) {
  const shifted = new Date(date);
  shifted.setMinutes(shifted.getMinutes() - shifted.getTimezoneOffset());
  return shifted.toISOString().slice(0, 10);
}

export default async function AdminDocumentsPage() {
  const orders = (await fetchAdminOrders()).filter(
    (order) => !HIDDEN_STATUSES.has(order.status),
  );
  const today = new Date();
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);

  return (
    <div>
      <div>
        <p className="text-xs font-semibold uppercase tracking-[.15em] text-muted">Админка</p>
        <h1 className="mt-2 font-display text-4xl font-semibold tracking-tight sm:text-5xl">
          Накладные и счета
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-muted">
          Печатные документы по каждому заказу: счёт на оплату и накладная.
          Смешанные заказы автоматически делятся на два счёта по цехам.
        </p>
      </div>

      {/* Выгрузка для 1С Бухгалтерии: CSV открывается в Excel двойным кликом */}
      <section className="mt-6 rounded-card border border-black/10 bg-white p-5">
        <p className="text-xs font-semibold uppercase tracking-[.15em] text-muted">Выгрузка для 1С</p>
        <form
          action="/api/admin/export/1c"
          method="get"
          target="_blank"
          className="mt-3 flex flex-wrap items-end gap-3"
        >
          <label className="grid gap-1.5 text-sm font-semibold text-dark">
            С даты
            <input
              className="min-h-11 rounded-btn border border-black/10 bg-cream px-3 py-2 text-sm font-medium text-dark outline-none focus:border-coral"
              type="date"
              name="from"
              defaultValue={toDateInputValue(monthStart)}
              required
            />
          </label>
          <label className="grid gap-1.5 text-sm font-semibold text-dark">
            По дату
            <input
              className="min-h-11 rounded-btn border border-black/10 bg-cream px-3 py-2 text-sm font-medium text-dark outline-none focus:border-coral"
              type="date"
              name="to"
              defaultValue={toDateInputValue(today)}
              required
            />
          </label>
          <label className="flex min-h-11 items-center gap-2 text-sm font-semibold text-dark">
            <input className="size-4 accent-coral" type="checkbox" name="confirmed" value="1" defaultChecked />
            Только подтверждённые
          </label>
          <button
            className="min-h-11 rounded-btn border border-coral bg-coral px-5 py-2 text-sm font-bold text-white transition hover:bg-coral-hover"
            type="submit"
            name="type"
            value="orders"
          >
            Скачать заказы (CSV)
          </button>
          <button
            className="min-h-11 rounded-btn border border-black/15 bg-white px-5 py-2 text-sm font-semibold text-dark transition hover:bg-black/5"
            type="submit"
            name="type"
            value="clients"
          >
            Скачать клиентов (CSV)
          </button>
        </form>
        <p className="mt-3 text-xs leading-5 text-muted">
          Заказы: одна строка = одна позиция заказа (контрагент, БИН, товар, количество, цена,
          суммы). Клиенты: заготовка справочника контрагентов. Файлы в UTF-8 — Excel откроет
          двойным кликом. Галочка «Только подтверждённые» скрывает неподтверждённые заявки,
          отменённые не выгружаются никогда.
        </p>
      </section>

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
