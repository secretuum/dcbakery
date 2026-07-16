import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { DemoPaymentButton } from "@/src/components/payment/DemoPaymentButton";
import { PaymentStatusRefresh } from "@/src/components/payment/PaymentStatusRefresh";
import {
  getCompanyDetails,
  hasCompleteCompanyDetails,
} from "@/src/lib/company-details";
import { fetchAdminOrder, fetchAdminOrderItems } from "@/src/lib/supabase/admin";
import { formatPrice } from "@/src/lib/format";
import { orderStatusLabels, paymentStatusLabels } from "@/src/lib/order-status";
import {
  createDemoPaymentToken,
  isDemoPaymentMode,
} from "@/src/lib/payments";

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

  const [order, orderItems] = await Promise.all([
    fetchAdminOrder(orderId),
    fetchAdminOrderItems(orderId),
  ]);

  if (!order) {
    notFound();
  }

  const companyDetails = getCompanyDetails();
  const isDemoMode = isDemoPaymentMode();
  const baseState = getPayState(order.status, order.payment_status);
  const state =
    isDemoMode && order.status === "confirmed_waiting_payment"
      ? {
          ...baseState,
          text: "Заказ подтвержден менеджером. Введите тестовые данные карты ниже: реальные деньги в демо-режиме не списываются.",
        }
      : baseState;
  const demoPaymentToken =
    isDemoMode && order.payment_id
      ? await createDemoPaymentToken(order.id, order.payment_id)
      : null;
  const hasCompanyDetails = hasCompleteCompanyDetails(companyDetails);
  const invoiceAvailable =
    hasCompanyDetails &&
    !["pending_manager_confirmation", "new", "change_proposed", "canceled", "cancelled"].includes(
      order.status,
    );
  const naklAvailable = invoiceAvailable;
  const avrAvailable = order.status === "completed";
  const isExternalPaymentUrl =
    Boolean(order.payment_url) && !order.payment_url?.includes(`/pay/${order.id}`);

  return (
    <main className="min-h-screen bg-cream px-5 py-10 text-dark lg:px-8 lg:py-16">
      <section className="mx-auto max-w-4xl rounded-card border border-black/10 bg-white p-5 sm:p-8 lg:p-10">
        {order.status === "pending_manager_confirmation" || order.status === "new" ? (
          <PaymentStatusRefresh />
        ) : null}
        <p className="text-xs font-semibold uppercase tracking-[.15em] text-muted">{state.eyebrow}</p>
        <h1 className="mt-3 break-all font-data text-3xl font-bold tracking-tight sm:text-5xl">
          {order.order_number}
        </h1>
        <p className="mt-4 text-base leading-7 text-muted">{state.text}</p>

        {isDemoMode ? (
          <p className="mt-5 rounded-btn bg-coral-light px-4 py-3 text-sm font-semibold text-burgundy">
            Демо-режим: реквизиты и платежи тестовые, реальные деньги не используются.
          </p>
        ) : null}

        <div className="mt-8 grid gap-3 sm:grid-cols-3">
          <div className="rounded-btn border border-black/5 bg-cream px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-[.08em] text-muted">Сумма</p>
            <p className="mt-1 font-data text-xl font-bold">{formatPrice(order.total_amount)}</p>
          </div>
          <div className="rounded-btn border border-black/5 bg-cream px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-[.08em] text-muted">Статус</p>
            <p className="mt-1 text-sm font-semibold">{orderStatusLabels[order.status]}</p>
          </div>
          <div className="rounded-btn border border-black/5 bg-cream px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-[.08em] text-muted">Оплата</p>
            <p className="mt-1 text-sm font-semibold">
              {order.payment_status ? paymentStatusLabels[order.payment_status] : "Не оплачен"}
            </p>
          </div>
        </div>

        {orderItems.length > 0 ? (
          <section className="mt-8 rounded-card border border-black/5 bg-cream p-5">
            <p className="text-xs font-semibold uppercase tracking-[.08em] text-muted">Состав заказа</p>
            <ul className="mt-4 space-y-2">
              {orderItems.map((item) => (
                <li
                  key={item.id}
                  className="flex items-baseline justify-between gap-3 rounded-btn border border-black/5 bg-white px-4 py-3 text-sm"
                >
                  <span className="font-semibold text-dark">
                    {item.product_name}{" "}
                    <span className="font-data text-muted">
                      × {item.qty} {item.unit}
                    </span>
                  </span>
                  <span className="shrink-0 font-data font-bold text-dark">
                    {formatPrice(item.total_amount)}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        <section className="mt-8 rounded-card border border-black/5 bg-cream p-5">
          <p className="text-xs font-semibold uppercase tracking-[.08em] text-muted">Документы</p>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <div className="rounded-btn border border-black/5 bg-white p-4">
              <p className="font-display text-base font-semibold">Счет на оплату</p>
              <p className="mt-2 text-sm leading-6 text-muted">
                Формируется после подтверждения менеджером.
              </p>
              {invoiceAvailable ? (
                <Link
                  className="mt-4 inline-flex min-h-11 items-center justify-center rounded-btn border border-coral bg-coral px-4 py-2 text-sm font-bold text-white transition hover:bg-coral-hover"
                  href={`/documents/invoice/${order.id}`}
                >
                  Открыть счет
                </Link>
              ) : (
                <p className="mt-4 text-sm font-semibold text-burgundy">
                  {hasCompanyDetails ? "Ждет подтверждения" : "Реквизиты настраиваются"}
                </p>
              )}
            </div>

            <div className="rounded-btn border border-black/5 bg-white p-4">
              <p className="font-display text-base font-semibold">Накладная</p>
              <p className="mt-2 text-sm leading-6 text-muted">
                Товарная накладная для бухгалтерии.
              </p>
              {naklAvailable ? (
                <Link
                  className="mt-4 inline-flex min-h-11 items-center justify-center rounded-btn border border-dark bg-dark px-4 py-2 text-sm font-bold text-white transition hover:bg-dark/80"
                  href={`/documents/nakl/${order.id}`}
                >
                  Открыть накладную
                </Link>
              ) : (
                <p className="mt-4 text-sm font-semibold text-burgundy">
                  {hasCompanyDetails ? "Ждет подтверждения" : "Реквизиты настраиваются"}
                </p>
              )}
            </div>

            <div className="rounded-btn border border-black/5 bg-white p-4">
              <p className="font-display text-base font-semibold">АВР</p>
              <p className="mt-2 text-sm leading-6 text-muted">
                Акт выполненных работ — доступен после завершения заказа.
              </p>
              {avrAvailable ? (
                <Link
                  className="mt-4 inline-flex min-h-11 items-center justify-center rounded-btn border border-dark bg-dark px-4 py-2 text-sm font-bold text-white transition hover:bg-dark/80"
                  href={`/documents/avr/${order.id}`}
                >
                  Открыть АВР
                </Link>
              ) : (
                <p className="mt-4 text-sm font-semibold text-burgundy">После завершения заказа</p>
              )}
            </div>
          </div>
        </section>

        {isDemoMode &&
        order.status === "confirmed_waiting_payment" &&
        order.payment_id &&
        demoPaymentToken ? (
          <div className="mt-6">
            <DemoPaymentButton orderId={order.id} paymentToken={demoPaymentToken} />
          </div>
        ) : null}

        {order.payment_status === "failed" ? (
          <p className="mt-6 rounded-btn bg-raspberry/10 px-4 py-3 text-sm font-semibold text-raspberry">
            Последняя попытка оплаты не прошла. Деньги не списаны, попробуйте еще раз.
          </p>
        ) : null}

        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          {isExternalPaymentUrl ? (
            <a
              href={order.payment_url ?? "#"}
              className="inline-flex min-h-12 items-center justify-center rounded-btn border border-coral bg-coral px-5 py-3 text-sm font-bold text-white transition hover:bg-coral-hover"
            >
              Оплатить
            </a>
          ) : null}
          <Link
            href="/catalog"
            className="inline-flex min-h-12 items-center justify-center rounded-btn border border-black/15 bg-white px-5 py-3 text-sm font-semibold text-dark transition hover:bg-black/5"
          >
            Вернуться в каталог
          </Link>
        </div>
      </section>
    </main>
  );
}
