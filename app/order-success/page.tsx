import type { Metadata } from "next";
import Link from "next/link";

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
      <section className="mx-auto max-w-3xl rounded-card bg-white p-8 text-center shadow-[0_24px_80px_rgba(120,51,38,0.12)] sm:p-10">
        <div className="mx-auto flex size-20 items-center justify-center rounded-full bg-coral-light">
          <span className="block size-10 rounded-full bg-coral shadow-[0_0_0_12px_rgba(244,123,111,0.16)]" />
        </div>
        <p className="mt-8 text-sm font-black uppercase text-raspberry">Заявка отправлена</p>
        <h1 className="mt-3 text-5xl font-black tracking-tight sm:text-6xl">{orderNumber}</h1>
        <p className="mx-auto mt-4 max-w-xl text-base font-semibold leading-7 text-muted">
          Менеджер проверит наличие, сумму и доставку. После подтверждения мы отправим ссылку на
          оплату в WhatsApp.
        </p>

        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Link
            href="/catalog"
            className="inline-flex min-h-12 items-center justify-center rounded-btn bg-coral px-5 py-3 text-sm font-black text-white transition hover:bg-coral-hover"
          >
            Вернуться в каталог
          </Link>
          <a
            href="https://wa.me/77000000000"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-h-12 items-center justify-center rounded-btn bg-coral-light px-5 py-3 text-sm font-black text-burgundy transition hover:bg-white"
          >
            Написать в WhatsApp
          </a>
          {hasOrderId ? (
            <Link
              href={`/pay/${orderId}`}
              className="inline-flex min-h-12 items-center justify-center rounded-btn bg-white px-5 py-3 text-sm font-black text-burgundy transition hover:bg-coral-light"
            >
              Посмотреть заказ
            </Link>
          ) : null}
        </div>
      </section>
    </main>
  );
}
