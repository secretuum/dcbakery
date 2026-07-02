import type { Metadata } from "next";
import { CancelOrderForm } from "@/src/components/admin/CancelOrderForm";
import { AvrRequestButton } from "@/src/components/admin/AvrRequestButton";
import Link from "next/link";
import { ConfirmOrderButton } from "@/src/components/admin/ConfirmOrderButton";
import { MarkOrderPaidButton } from "@/src/components/admin/MarkOrderPaidButton";
import { notFound } from "next/navigation";
import { OrderSlaStatus } from "@/src/components/admin/OrderSlaStatus";
import { OrderStatusSelect } from "@/src/components/admin/OrderStatusSelect";
import { OrderRevisionForm } from "@/src/components/admin/OrderRevisionForm";
import { PaymentStatusBadge } from "@/src/components/admin/PaymentStatusBadge";
import { fetchProducts } from "@/src/lib/catalog";
import { fetchAdminOrder, fetchAdminOrderItems } from "@/src/lib/supabase/admin";
import { formatPrice } from "@/src/lib/format";

type AdminOrderPageProps = {
  params: Promise<{
    id: string;
  }>;
};

function formatDateTime(value?: string | null) {
  if (!value) {
    return "не указано";
  }

  return new Intl.DateTimeFormat("ru-RU", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function optional(value?: string | null) {
  return value?.trim() ? value : "не указано";
}

export async function generateMetadata({ params }: AdminOrderPageProps): Promise<Metadata> {
  const { id } = await params;
  const order = await fetchAdminOrder(id);

  return {
    title: order ? `${order.order_number} | Админка DC Bakery` : "Заказ не найден",
  };
}

export default async function AdminOrderPage({ params }: AdminOrderPageProps) {
  const { id } = await params;
  const [order, items, products] = await Promise.all([
    fetchAdminOrder(id),
    fetchAdminOrderItems(id),
    fetchProducts(),
  ]);

  if (!order) {
    notFound();
  }

  const isLocked =
    order.payment_status === "paid" ||
    order.status === "paid" ||
    order.status === "completed" ||
    order.status === "canceled" ||
    order.status === "cancelled";

  return (
    <div>
      <Link href="/admin/orders" className="text-sm font-black text-muted transition hover:text-dark">
        Назад к заказам
      </Link>

      <div className="mt-5 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <p className="text-sm font-black uppercase text-raspberry">Заказ</p>
            <OrderSlaStatus createdAt={order.created_at} status={order.status} />
          </div>
          <h1 className="mt-3 text-4xl font-black tracking-tight sm:text-5xl">
            {order.order_number}
          </h1>
          <p className="mt-3 text-sm font-semibold text-muted">
            Создан: {formatDateTime(order.created_at)}
          </p>
        </div>
        <div className="rounded-card bg-white p-5 shadow-sm">
          <p className="text-xs font-black uppercase text-muted">Сумма</p>
          <p className="mt-2 text-4xl font-black text-dark">{formatPrice(order.total_amount)}</p>
        </div>
      </div>

      <div className="mt-8 grid gap-6 xl:grid-cols-[1fr_360px] xl:items-start">
        <div className="space-y-6">
          <section className="rounded-card bg-white p-5 shadow-sm sm:p-6">
            <h2 className="text-2xl font-black tracking-tight">Клиент и доставка</h2>
            <dl className="mt-5 grid gap-4 sm:grid-cols-2">
              {[
                ["Компания", order.company_name],
                ["БИН / ИП", optional(order.customer_bin)],
                ["Контакт", order.customer_name],
                ["Телефон", order.customer_phone],
                ["Email", optional(order.customer_email)],
                ["Адрес", optional(order.delivery_address)],
                ["Дата доставки", optional(order.delivery_date)],
                ["Время", optional(order.delivery_time)],
                ["Оплата", optional(order.payment_method)],
                ["АВР", order.request_avr ? "запрошен" : "не требуется"],
              ].map(([label, value]) => (
                <div key={label} className="rounded-btn bg-cream px-4 py-3">
                  <dt className="text-xs font-black uppercase text-muted">{label}</dt>
                  <dd className="mt-1 text-sm font-black text-dark">{value}</dd>
                </div>
              ))}
            </dl>

            {order.comment ? (
              <div className="mt-4 rounded-btn bg-coral-light px-4 py-3">
                <p className="text-xs font-black uppercase text-muted">Комментарий</p>
                <p className="mt-1 text-sm font-bold leading-6 text-dark">{order.comment}</p>
              </div>
            ) : null}
          </section>

          <section className="overflow-hidden rounded-card bg-white shadow-sm">
            <div className="border-b border-black/10 p-5 sm:p-6">
              <h2 className="text-2xl font-black tracking-tight">Состав заказа</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-[480px] w-full border-collapse text-left">
                <thead className="bg-coral-light text-xs font-black uppercase text-burgundy">
                  <tr>
                    <th className="px-5 py-4">Товар</th>
                    <th className="px-5 py-4">Кол-во</th>
                    <th className="px-5 py-4">Цена</th>
                    <th className="px-5 py-4">Сумма</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-black/10 text-sm font-semibold">
                  {items.map((item) => (
                    <tr key={item.id}>
                      <td className="px-5 py-4">
                        <p className="font-black text-dark">{item.product_name}</p>
                        <p className="mt-1 text-xs text-muted">{item.product_id}</p>
                      </td>
                      <td className="px-5 py-4">
                        {item.qty} {item.unit}
                      </td>
                      <td className="px-5 py-4">{formatPrice(item.price)}</td>
                      <td className="px-5 py-4 font-black">{formatPrice(item.total_amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <OrderRevisionForm
            disabled={isLocked}
            items={items}
            orderId={order.id}
            products={products}
          />
        </div>

        <aside className="rounded-card bg-white p-5 shadow-sm xl:sticky xl:top-8">
          <OrderStatusSelect orderId={order.id} status={order.status} />
          <ConfirmOrderButton orderId={order.id} status={order.status} />
          <MarkOrderPaidButton
            orderId={order.id}
            paymentStatus={order.payment_status}
            status={order.status}
          />
          <CancelOrderForm disabled={isLocked} orderId={order.id} />
          <AvrRequestButton orderId={order.id} requested={order.request_avr === true} />

          <div className="mt-6 rounded-btn bg-coral-light px-4 py-3">
            <p className="text-xs font-black uppercase text-muted">Оплата</p>
            <div className="mt-2">
              <PaymentStatusBadge status={order.payment_status} />
            </div>
            {order.payment_url ? (
              <Link
                href={order.payment_url}
                className="mt-3 inline-flex text-sm font-black text-burgundy transition hover:text-dark"
              >
                Открыть ссылку оплаты
              </Link>
            ) : null}
          </div>
          <div className="mt-6 rounded-btn bg-cream px-4 py-3">
            <p className="text-xs font-black uppercase text-muted">Telegram</p>
            <p className="mt-1 text-sm font-bold text-dark">
              {order.telegram_message_id ? `ID ${order.telegram_message_id}` : "не отправлено"}
            </p>
          </div>
          <div className="mt-3 rounded-btn bg-cream px-4 py-3">
            <p className="text-xs font-black uppercase text-muted">WhatsApp</p>
            <p className="mt-1 text-sm font-bold text-dark">
              {order.whatsapp_message_id ? `ID ${order.whatsapp_message_id}` : "не отправлено"}
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}
