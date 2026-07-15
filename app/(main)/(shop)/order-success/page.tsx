import type { Metadata } from "next";
import Link from "next/link";
import { WHATSAPP_SUPPORT_NUMBER } from "@/app/constants";

type OrderSuccessPageProps = {
  searchParams: Promise<{
    id?: string | string[];
    n?: string | string[];
  }>;
};

export const metadata: Metadata = {
  title: "Заявка отправлена | DC Bakery",
  description: "Подтверждение отправки B2B-заявки DC Bakery.",
};

function getOrderNumber(value: string | string[] | undefined) {
  if (Array.isArray(value)) {
    return value[0] ?? "DCB";
  }

  return value ?? "DCB";
}

export default async function OrderSuccessPage({ searchParams }: OrderSuccessPageProps) {
  const { id, n } = await searchParams;
  const orderNumber = getOrderNumber(n);
  const orderId = getOrderNumber(id);
  const hasOrderId = orderId !== "DCB";

  return (
    <main className="min-h-screen bg-cream px-5 py-16 text-dark lg:px-8">
      <section className="mx-auto max-w-3xl rounded-card border border-black/10 bg-white p-8 text-center sm:p-10">
        <div className="mx-auto flex size-20 items-center justify-center rounded border border-black/10 bg-coral-light">
          <span className="block size-10 rounded bg-coral" />
        </div>
        <p className="mt-8 text-xs font-semibold uppercase tracking-[.15em] text-muted">Заявка отправлена</p>
        <h1 className="mt-3 break-all font-data text-3xl font-bold tracking-tight sm:text-5xl">{orderNumber}</h1>
        <p className="mx-auto mt-4 max-w-xl text-base leading-7 text-muted">
          Менеджер свяжется с вами в ближайшее время — уточнит наличие, итоговую сумму и детали
          доставки. Счёт придёт в WhatsApp сразу после подтверждения.
        </p>

        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Link
            href="/catalog"
            className="inline-flex min-h-12 items-center justify-center rounded-btn border border-coral bg-coral px-5 py-3 text-sm font-bold text-white transition hover:bg-coral-hover"
          >
            Вернуться в каталог
          </Link>
          <a
            href={`https://wa.me/${WHATSAPP_SUPPORT_NUMBER}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-h-12 items-center justify-center rounded-btn border border-coral bg-white px-5 py-3 text-sm font-bold text-coral transition hover:bg-coral hover:text-white"
          >
            Написать в WhatsApp
          </a>
          {hasOrderId ? (
            <Link
              href={`/pay/${orderId}`}
              className="inline-flex min-h-12 items-center justify-center rounded-btn border border-black/15 bg-white px-5 py-3 text-sm font-semibold text-dark transition hover:bg-black/5"
            >
              Посмотреть заказ
            </Link>
          ) : null}
        </div>
      </section>
    </main>
  );
}
