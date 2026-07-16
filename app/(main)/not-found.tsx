import Link from "next/link";

export default function NotFound() {
  return (
    <main className="min-h-screen bg-cream px-5 py-16 text-dark lg:px-8">
      <section className="mx-auto max-w-2xl rounded-card bg-white p-8 text-center shadow-[0_18px_60px_rgba(120,51,38,0.10)]">
        <p className="text-sm font-bold uppercase text-raspberry">404</p>
        <h1 className="mt-3 text-4xl font-bold tracking-tight">Страница не найдена</h1>
        <p className="mt-4 text-sm font-semibold leading-6 text-muted">
          Такой раздел или товар пока не добавлен в каталог DC Bakery.
        </p>
        <Link
          href="/catalog"
          className="mt-6 inline-flex min-h-12 items-center justify-center rounded-btn bg-coral px-5 py-3 text-sm font-bold text-white transition hover:bg-coral-hover"
        >
          Вернуться в каталог
        </Link>
      </section>
    </main>
  );
}
