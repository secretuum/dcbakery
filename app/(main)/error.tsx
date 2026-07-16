"use client";

import { Button } from "@/src/components/ui/Button";

type ErrorPageProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

export default function ErrorPage({ error, reset }: ErrorPageProps) {
  return (
    <main className="min-h-screen bg-cream px-5 py-16 text-dark lg:px-8">
      <section className="mx-auto max-w-2xl rounded-card bg-white p-8 text-center shadow-[0_18px_60px_rgba(120,51,38,0.10)]">
        <p className="text-sm font-bold uppercase text-raspberry">Ошибка</p>
        <h1 className="mt-3 text-4xl font-bold tracking-tight">Что-то пошло не так</h1>
        <p className="mt-4 text-sm font-semibold leading-6 text-muted">
          {error.message || "Обновите экран или попробуйте повторить действие."}
        </p>
        <Button onClick={reset} className="mt-6">
          Попробовать снова
        </Button>
      </section>
    </main>
  );
}
