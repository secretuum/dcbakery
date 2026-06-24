import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { DemoPaymentButton } from "@/src/components/payment/DemoPaymentButton";
import {
  getCompanyDetails,
  hasCompleteCompanyDetails,
} from "@/src/lib/company-details";
import { fetchAdminOrder } from "@/src/lib/supabase/admin";
import { formatPrice } from "@/src/lib/format";
import { orderStatusLabels, paymentStatusLabels } from "@/src/lib/order-status";
import { isDemoPaymentMode } from "@/src/lib/payments";

type PayPageProps = {
  params: Promise<{
    orderId: string;
  }>;
};

export const metadata: Metadata = {
  title: "Счет и документы | DC Bakery",
  description: "Статус заказа, счет на оплату и документы DC Bakery.",
};

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}

function getPayState(status: string, paymentStatus?: string | null) {
  if (status === "pending_manager_confirmation" || status === "new") {
    return {
      eyebrow: "Заказ на проверке",
      title: "Счет пока недоступен",
      text: "Менеджер проверит наличие товаров, сумму и доставку. После подтверждения здесь появится счет на оплату.",
    };
  }

  if (status === "paid" || paymentStatus === "paid") {
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

  if (status === "in_progress" || status === "delivering" || status === "completed") {
    return {
      eyebrow: status === "completed" ? "Заказ завершен" : "Заказ в работе",
      title: "Документы по заказу",
      text:
        paymentStatus === "paid"
          ? "Оплата получена. Здесь доступны документы по заказу."
          : "Статус оплаты ведется отдельно. Если счет еще не оплачен, используйте банковские реквизиты из документа ниже.",
    };
  }

  return {
    eyebrow: "Ожидает оплаты",
    title: "Заказ подтвержден",
    text: "Счет подготовлен. Оплатите его по банковским реквизитам, после поступления денег статус заказа обновится.",
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

  const state = getPayState(order.status, order.payment_status);
  const companyDetails = getCompanyDetails();
  const isDemoMode = isDemoPaymentMode();
  const hasCompanyDetails = hasCompleteCompanyDetails(companyDetails);
  const invoiceAvailable =
    hasCompanyDetails &&
    !["pending_manager_confirmation", "new", "change_proposed", "canceled", "cancelled"].includes(
      order.status,
    );
  const avrAvailable = order.request_avr === true && order.status === "completed";
  const isExternalPaymentUrl =
    Boolean(order.payment_url) && !order.payment_url?.includes(`/pay/${order.id}`);

  return (
    <main className="min-h-screen bg-cream px-5 py-16 text-dark lg:px-8">
      <section className="mx-auto max-w-4xl rounded-card bg-white p-8 shadow-[0_24px_80px_rgba(120,51,38,0.12)] sm:p-10">
        <p className="text-sm font-black uppercase text-raspberry">{state.eyebrow}</p>
        <h1 className="mt-3 text-5xl font-black tracking-tight sm:text-6xl">
          {order.order_number}
        </h1>
        <p className="mt-4 text-base font-semibold leading-7 text-muted">{state.text}</p>

        {isDemoMode ? (
          <p className="mt-5 rounded-btn bg-[#fff1b8] px-4 py-3 text-sm font-black text-[#7a4b00]">
            Демо-режим: реквизиты и платежи тестовые, реальные деньги не используются.
          </p>
        ) : null}

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

        <section className="mt-8 rounded-card bg-cream p-5">
          <p className="text-xs font-black uppercase text-raspberry">Документы</p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div className="rounded-btn bg-white p-4">
              <p className="text-lg font-black">Счет на оплату</p>
              <p className="mt-2 text-sm font-semibold leading-6 text-muted">
                Формируется автоматически после подтверждения менеджером.
              </p>
              {invoiceAvailable ? (
                <Link
                  className="mt-4 inline-flex min-h-11 items-center justify-center rounded-btn bg-coral px-4 py-2 text-sm font-black text-white"
                  href={`/documents/invoice/${order.id}`}
                >
                  Открыть счет
                </Link>
              ) : (
                <p className="mt-4 text-sm font-black text-burgundy">
                  {hasCompanyDetails ? "Ждет подтверждения менеджера" : "Реквизиты поставщика настраиваются"}
                </p>
              )}
            </div>

            <div className="rounded-btn bg-white p-4">
              <p className="text-lg font-black">АВР</p>
              <p className="mt-2 text-sm font-semibold leading-6 text-muted">
                {order.request_avr
                  ? "Запрошен при оформлении и будет доступен после завершения заказа."
                  : "Не был запрошен при оформлении. Добавить его сможет менеджер."}
              </p>
              {avrAvailable ? (
                <Link
                  className="mt-4 inline-flex min-h-11 items-center justify-center rounded-btn bg-dark px-4 py-2 text-sm font-black text-white"
                  href={`/documents/avr/${order.id}`}
                >
                  Открыть АВР
                </Link>
              ) : null}
            </div>
          </div>
        </section>

        {isDemoMode &&
        order.status === "confirmed_waiting_payment" &&
        order.payment_id?.startsWith("demo-") ? (
          <div className="mt-6">
            <DemoPaymentButton orderId={order.id} paymentId={order.payment_id} />
          </div>
        ) : null}

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
