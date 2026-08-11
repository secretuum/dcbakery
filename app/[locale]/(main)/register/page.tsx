import type { Metadata } from "next";
import Link from "next/link";
import { peekRegistrationToken } from "@/src/lib/registration/reg-link";
import { RegisterFromLinkForm } from "@/src/components/profile/RegisterFromLinkForm";

// Регистрация по одноразовой ссылке из WhatsApp. Токен ЧИТАЕМ (peek), но НЕ гасим на
// рендере — гашение при отправке формы (чтобы префетч не сжёг ссылку). Всегда динамика.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Регистрация | DC Bakery",
  robots: { index: false, follow: false },
};

export default async function RegisterPage({
  searchParams,
}: {
  searchParams: Promise<{ rt?: string }>;
}) {
  const rt = (await searchParams)?.rt ?? "";
  const peek = rt ? await peekRegistrationToken(rt, new Date().toISOString()) : null;

  if (!peek) {
    return (
      <main className="min-h-screen bg-cream px-5 py-16 text-dark">
        <section className="mx-auto max-w-md rounded-card border border-black/10 bg-white p-8 text-center">
          <p className="text-xs font-semibold uppercase tracking-[.15em] text-muted">Регистрация</p>
          <h1 className="mt-3 text-2xl font-bold">Ссылка недействительна</h1>
          <p className="mt-4 text-sm leading-6 text-muted">
            Похоже, ссылка устарела или уже была использована (действует 30 минут).
            Напишите нам в WhatsApp — вышлем новую.
          </p>
          <Link className="mt-6 inline-flex font-bold text-coral" href="/catalog">
            В каталог
          </Link>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-cream px-5 py-12 text-dark lg:py-16">
      <section className="mx-auto max-w-md rounded-card border border-black/10 bg-white p-6 sm:p-8">
        <p className="text-xs font-semibold uppercase tracking-[.15em] text-muted">Регистрация</p>
        <h1 className="mt-3 text-2xl font-bold">Завершите профиль</h1>
        <p className="mt-2 text-sm leading-6 text-muted">
          Номер подтверждён через WhatsApp. Задайте пароль и реквизиты — счёт и документы
          будут приходить в WhatsApp.
        </p>
        <div className="mt-6">
          <RegisterFromLinkForm rt={rt} phone={peek.phone} />
        </div>
      </section>
    </main>
  );
}
