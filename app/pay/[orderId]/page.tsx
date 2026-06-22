import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { fetchAdminOrder } from "@/src/lib/supabase/admin";
import { formatPrice } from "@/src/lib/format";
import { orderStatusLabels, paymentStatusLabels } from "@/src/lib/order-status";

type PayPageProps = {
  params: Promise<{
    orderId: string;
  }>;
};

export const metadata: Metadata = {
  title: "Оплата заказа | DC Bakery",
  description: "Статус подтверждения и оплаты заказа DC Bakery.",
};

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}

function getPayState(status: string) {
  if (status === "pending_manager_confirmation" || status === "new") {
    return {
      eyebrow: "Заказ на проверке",
      title: "Оплата пока недоступна",
      text: "Менеджер проверит наличие товаров, сумму и доставку. После подтверждения мы отправим ссылку на оплату в WhatsApp.",
    };
  }

  if (status === "paid" || status === "in_progress" || status === "delivering" || status === "completed") {
    return {
      eyebrow: "Оплата получена",
      title: "Заказ уже оплачен",
      text: "Заказ передан команде DC Bakery. По деталям доставки менеджер свяжется с вами.",
    };
  }

  if (status === "canceled" || status === "cancelled") {
    return {
      eyebrow: "Заказ отменен",
      title: "Оплата недоступна",
      text: "Если отмена произошла по ошибке, свяжитесь с менеджером DC Bakery.",
    };
  }

  return {
    eyebrow: "Ожидает оплаты",
    title: "Заказ подтвержден",
    text: "Ссылка на оплату подготовлена. Если кнопка оплаты пока недоступна, менеджер отправит актуальный способ оплаты в WhatsApp.",
  };
}

export default async function PayPage({ params }: PayPageProps) {
  const { orderId } = await params;

  if (!isUuid(orderId)) {
    notFound();
  }

  const order = await fetchAdminOrder(orderId);

  if (!order) {
    notFound();
  }

  const state = getPayState(order.status);
  const isExternalPaymentUrl =
    Boolean(order.payment_url) && !order.payment_url?.includes(`/pay/${order.id}`);

  return (
    <main className="min-h-screen bg-cream px-5 py-16 text-dark lg:px-8">
      <section className="mx-auto max-w-3xl rounded-card bg-white p-8 shadow-[0_24px_80px_rgba(120,51,38,0.12)] sm:p-10">
        <p className="text-sm font-black uppercase text-raspberry">{state.eyebrow}</p>
        <h1 className="mt-3 text-5xl font-black tracking-tight sm:text-6xl">
          {order.order_number}
        </h1>
        <p className="mt-4 text-base font-semibold leading-7 text-muted">{state.text}</p>

        <div className="mt-8 grid gap-3 sm:grid-cols-3">
          <div className="rounded-btn bg-cream px-4 py-3">
            <p className="text-xs font-black uppercase text-muted">Сумма</p>
            <p className="mt-1 text-xl font-black">{formatPrice(order.total_amount)}</p>
          </div>
          <div className="rounded-btn bg-cream px-4 py-3">
            <p className="text-xs font-black uppercase text-muted">Статус</p>
            <p className="mt-1 text-sm font-black">{orderStatusLabels[order.status]}</p>
          </div>
          <div className="rounded-btn bg-cream px-4 py-3">
            <p className="text-xs font-black uppercase text-muted">Оплата</p>
            <p className="mt-1 text-sm font-black">
              {order.payment_status ? paymentStatusLabels[order.payment_status] : "Не оплачен"}
            </p>
          </div>
        </div>

        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          {isExternalPaymentUrl ? (
            <a
              href={order.payment_url ?? "#"}
              className="inline-flex min-h-12 items-center justify-center rounded-btn bg-coral px-5 py-3 text-sm font-black text-white transition hover:bg-coral-hover"
            >
              Оплатить
            </a>
          ) : null}
          <Link
            href="/catalog"
            className="inline-flex min-h-12 items-center justify-center rounded-btn bg-coral-light px-5 py-3 text-sm font-black text-burgundy transition hover:bg-white"
          >
            Вернуться в каталог
          </Link>
        </div>
      </section>
    </main>
  );
}
