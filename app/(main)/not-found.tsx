import Link from "next/link";
import { getLocale, getT } from "@/src/i18n/server";
import { withLocale } from "@/src/i18n/routing";

export default async function NotFound() {
  const [t, locale] = await Promise.all([getT(), getLocale()]);
  return (
    <main className="min-h-screen bg-cream px-5 py-16 text-dark lg:px-8">
      <section className="mx-auto max-w-2xl rounded-card border border-black/10 bg-white p-8 text-center shadow-lg sm:p-10">
        <p className="text-[11px] font-bold uppercase tracking-[.15em] text-coral">404</p>
        <h1 className="mt-3 font-display text-4xl font-semibold tracking-tight">{t("Страница не найдена")}</h1>
        <p className="mt-4 text-sm font-semibold leading-6 text-muted">
          {t("Такой раздел или товар пока не добавлен в каталог DC Bakery.")}
        </p>
        <Link
          href={withLocale("/catalog", locale)}
          className="mt-6 inline-flex min-h-12 items-center justify-center rounded-full bg-coral px-5 py-3 text-sm font-bold text-white transition hover:bg-coral-hover"
        >
          {t("Вернуться в каталог")}
        </Link>
      </section>
    </main>
  );
}
