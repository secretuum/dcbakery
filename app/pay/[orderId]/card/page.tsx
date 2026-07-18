import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { HalykPaymentWidget } from "@/src/components/payment/HalykPaymentWidget";
import {
  createHalykPaymentAuth,
  createHalykSecretHash,
  getHalykConfig,
} from "@/src/lib/providers/halyk";
import { getOrCreatePaymentAttempt } from "@/src/lib/supabase/payments-store";
import { fetchAdminOrder } from "@/src/lib/supabase/admin";
import { formatPrice } from "@/src/lib/format";

// Оплата банковской картой через Halyk ePay. Страница активна только когда
// заданы HALYK_* env; заказ должен быть подтверждён и не оплачен.

export const metadata: Metadata = {
  title: "Оплата картой | DC Bakery",
};

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function Unavailable({ orderId, reason }: { orderId: string; reason: string }) {
  return (
    <main className="min-h-screen bg-cream px-5 py-16 text-dark lg:px-8">
      <section className="mx-auto max-w-2xl rounded-card bg-white p-8 text-center shadow-sm">
        <p className="text-sm font-bold uppercase text-raspberry">Оплата картой</p>
        <h1 className="mt-3 text-3xl font-bold">Оплата сейчас недоступна</h1>
        <p className="mt-4 text-sm font-semibold leading-6 text-muted">{reason}</p>
        <Link className="mt-6 inline-flex font-bold text-burgundy" href={`/pay/${orderId}`}>
          Вернуться к заказу
        </Link>
      </section>
    </main>
  );
}

export default async function CardPaymentPage({
  params,
}: {
  params: Promise<{ orderId: string }>;
}) {
  const { orderId } = await params;

  if (!isUuid(orderId)) {
    notFound();
  }

  const order = await fetchAdminOrder(orderId);

  if (!order) {
    notFound();
  }

  const config = getHalykConfig();

  if (!config) {
    return (
      <Unavailable
        orderId={order.id}
        reason="Оплата картой подключается. Пока оплатите по счёту — реквизиты на странице заказа."
      />
    );
  }

  if (order.payment_status === "paid" || order.status === "paid") {
    return <Unavailable orderId={order.id} reason="Заказ уже оплачен." />;
  }

  if (order.status !== "confirmed_waiting_payment") {
    return (
      <Unavailable
        orderId={order.id}
        reason="Оплата станет доступна после подтверждения заказа менеджером."
      />
    );
  }

  const origin = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://dc-bakery.kz").replace(/\/$/, "");

  let paymentObject: Record<string, unknown>;

  try {
    // Попытка платежа с числовым invoiceId (6+ цифр, уникален на операцию)
    const attempt = await getOrCreatePaymentAttempt(order, "halyk");
    const invoiceId = String(attempt.invoice_id);
    const secretHash = createHalykSecretHash(invoiceId);
    const postLink = `${origin}/api/payments/halyk/postlink`;
    const auth = await createHalykPaymentAuth({
      invoiceId,
      amount: Number(order.total_amount),
      postLink,
      failurePostLink: postLink,
    });

    paymentObject = {
      invoiceId,
      backLink: `${origin}/pay/${order.id}`,
      failureBackLink: `${origin}/pay/${order.id}`,
      postLink,
      failurePostLink: postLink,
      language: "rus",
      description: `Заказ ${order.order_number}, DC Bakery`,
      terminal: config.terminalId,
      amount: Number(order.total_amount),
      currency: "KZT",
      secret_hash: secretHash,
      auth,
    };
  } catch (error) {
    console.error("[halyk] Failed to prepare payment:", error);
    return (
      <Unavailable
        orderId={order.id}
        reason="Не удалось подготовить оплату. Попробуйте позже или оплатите по счёту."
      />
    );
  }

  return (
    <main className="min-h-screen bg-cream px-5 py-10 text-dark lg:px-8 lg:py-16">
      <section className="mx-auto max-w-2xl">
        <div className="rounded-card border border-black/10 bg-white p-6 sm:p-8">
          <p className="text-xs font-semibold uppercase tracking-[.15em] text-muted">
            Оплата банковской картой
          </p>
          <h1 className="mt-3 break-all font-data text-3xl font-semibold">{order.order_number}</h1>
          <p className="mt-2 font-data text-xl font-semibold text-coral">
            {formatPrice(order.total_amount)}
          </p>
          <p className="mt-4 text-sm leading-6 text-muted">
            Оплата проходит на защищённой странице Halyk Bank (Visa / Mastercard).
            Сайт не получает и не хранит данные карты. После оплаты статус заказа
            обновится автоматически.
          </p>

          <div className="mt-6">
            <HalykPaymentWidget jsUrl={config.paymentJsUrl} paymentObject={paymentObject} />
          </div>

          <Link
            className="mt-6 inline-flex text-sm font-bold text-burgundy"
            href={`/pay/${order.id}`}
          >
            ← Вернуться к заказу и счёту
          </Link>
        </div>
      </section>
    </main>
  );
}
