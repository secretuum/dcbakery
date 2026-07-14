import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { OrderStatusBadge } from "@/src/components/admin/OrderStatusBadge";
import { PaymentStatusBadge } from "@/src/components/admin/PaymentStatusBadge";
import { ClientProfileForm } from "@/src/components/admin/ClientProfileForm";
import { ClientCreditForm } from "@/src/components/admin/ClientCreditForm";
import { formatPrice } from "@/src/lib/format";
import {
  fetchClientByPhone,
  fetchClientOrderSummaries,
} from "@/src/lib/supabase/admin";
import { fetchWhatsAppClientByChatId } from "@/src/lib/whatsapp-client-store";

type AdminClientPageProps = {
  params: Promise<{
    chatId: string;
  }>;
};

function optional(value?: string | null) {
  return value?.trim() ? value : "не указано";
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("ru-RU", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export async function generateMetadata({ params }: AdminClientPageProps): Promise<Metadata> {
  const { chatId } = await params;
  const client = await fetchWhatsAppClientByChatId(decodeURIComponent(chatId)).catch(() => null);

  return {
    title: client ? `${optional(client.companyName)} | Клиенты DC Bakery` : "Клиент не найден",
  };
}

export default async function AdminClientPage({ params }: AdminClientPageProps) {
  const { chatId } = await params;
  const decodedChatId = decodeURIComponent(chatId);
  const client = await fetchWhatsAppClientByChatId(decodedChatId).catch(() => null);

  if (!client) {
    notFound();
  }

  const [orders, creditClient] = await Promise.all([
    fetchClientOrderSummaries({
      email: client.customerEmail ?? undefined,
      phone: client.customerPhone ?? undefined,
    }),
    client.customerPhone ? fetchClientByPhone(client.customerPhone) : Promise.resolve(null),
  ]);

  return (
    <div>
      <Link href="/admin/clients" className="text-sm font-black text-muted transition hover:text-dark">
        Назад к клиентам
      </Link>

      <div className="mt-5">
        <p className="text-sm font-black uppercase text-raspberry">Клиент</p>
        <h1 className="mt-2 text-4xl font-black tracking-tight sm:text-5xl">
          {optional(client.companyName)}
        </h1>
        <p className="mt-3 text-sm font-semibold text-muted">
          {optional(client.customerPhone)} · {decodedChatId}
        </p>
      </div>

      <div className="mt-8 grid gap-6 xl:grid-cols-[1fr_420px] xl:items-start">
        <div className="space-y-6">
          <ClientProfileForm client={client} />
          <ClientCreditForm
            client={creditClient}
            defaultPhone={client.customerPhone ?? ""}
            defaultName={client.companyName ?? client.customerName ?? ""}
          />

          <section className="overflow-hidden rounded-card bg-white shadow-[0_18px_60px_rgba(120,51,38,0.10)]">
            <div className="border-b border-black/10 p-5 sm:p-6">
              <h2 className="text-2xl font-black tracking-tight">История заказов</h2>
            </div>
            {orders.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="min-w-[760px] w-full border-collapse text-left">
                  <thead className="bg-coral-light text-xs font-black uppercase text-burgundy">
                    <tr>
                      <th className="px-5 py-4">Номер</th>
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
              <div className="p-6 text-sm font-bold text-muted">Заказов пока нет.</div>
            )}
          </section>
        </div>

        <aside className="rounded-card bg-white p-5 shadow-[0_18px_60px_rgba(120,51,38,0.10)] xl:sticky xl:top-8">
          <h2 className="text-2xl font-black tracking-tight">Адреса</h2>
          <div className="mt-4 space-y-3">
            {(client.addresses?.length
              ? client.addresses
              : client.deliveryAddress
                ? [{ address: client.deliveryAddress }]
                : []
            ).map((address, index) => (
              <div key={`${address.address}-${index}`} className="rounded-btn bg-cream px-4 py-3">
                <p className="text-xs font-black uppercase text-muted">Адрес {index + 1}</p>
                <p className="mt-1 text-sm font-black text-dark">{address.address}</p>
              </div>
            ))}
            {!client.addresses?.length && !client.deliveryAddress ? (
              <p className="text-sm font-bold text-muted">Адреса пока не указаны.</p>
            ) : null}
          </div>
        </aside>
      </div>
    </div>
  );
}
