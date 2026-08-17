import type { Metadata, Viewport } from "next";
import { notFound } from "next/navigation";
import { CartProvider } from "@/src/contexts/CartContext";
import { ToastProvider } from "@/src/contexts/ToastContext";
import { LocaleProvider } from "@/src/i18n/client";
import { LOCALES, OG_LOCALE, DEFAULT_LOCALE, isLocale, type Locale } from "@/src/i18n/config";
import { getT } from "@/src/i18n/server";
import { getDictionary } from "@/src/i18n/translate";
import { SITE_URL } from "@/src/lib/site-url";
import { Analytics } from "@/src/components/analytics/Analytics";
import { RouteTracker } from "@/src/components/analytics/RouteTracker";
import { fontVariables } from "@/app/fonts";
import "@/app/globals.css";

// Корень локализованных страниц. B3: [locale] — реальный корневой сегмент, поэтому
// getLocale() читает язык через next/root-params (без headers → без форс-динамики),
// а <html lang> и generateMetadata берут его прямо из params. Не-локализованные роуты
// (/admin, /pay, /documents) живут под своим корнем app/(unlocalized).

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

// SSG: заранее генерим три локали; неизвестная локаль → 404 (dynamicParams=false).
export function generateStaticParams() {
  return LOCALES.map((locale) => ({ locale }));
}
export const dynamicParams = false;

// ISR: публичные страницы отдаются статикой и фоново обновляются раз в час. Правки
// каталога/контента применяются мгновенно через revalidateTag (админка/оформление),
// это — бэкстоп. Страницы, читающие cookie (профиль/корзина/оформление), остаются
// динамическими сами по себе — revalidate на них не влияет.
export const revalidate = 3600;

const SITE_TITLE = "DC Bakery — B2B кондитерская и полуфабрикаты, Алматы";
const SITE_DESCRIPTION =
  "B2B-каталог десертов, полуфабрикатов и мяса для кофеен, ресторанов, магазинов и отелей.";

// Верификация вебмастеров (Google Search Console / Яндекс.Вебмастер / Bing) — через
// env, чтобы подключить без правки кода. Bing — через other.msvalidate.01.
const verification: NonNullable<Metadata["verification"]> = {};
if (process.env.GOOGLE_SITE_VERIFICATION) verification.google = process.env.GOOGLE_SITE_VERIFICATION;
if (process.env.YANDEX_VERIFICATION) verification.yandex = process.env.YANDEX_VERIFICATION;
if (process.env.BING_VERIFICATION) verification.other = { "msvalidate.01": process.env.BING_VERIFICATION };

// Метаданные СЧИТАЮТСЯ ПОД [locale]: заголовок/описание/og:locale соответствуют языку
// страницы. Язык берём из params (гарантированно валиден при dynamicParams=false).
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale: raw } = await params;
  const locale: Locale = isLocale(raw) ? raw : DEFAULT_LOCALE;
  const t = await getT(locale);
  const title = t(SITE_TITLE);
  const description = t(SITE_DESCRIPTION);

  return {
    metadataBase: new URL(SITE_URL),
    title,
    description,
    applicationName: "DC Bakery",
    keywords: [
      "DC Bakery",
      "десерты оптом Алматы",
      "полуфабрикаты оптом",
      "мясо оптом Алматы",
      "B2B поставки продуктов",
      "оптовая кондитерская Алматы",
      "поставки для кафе и ресторанов",
      "халал мясо оптом",
      "торты оптом",
      "выпечка оптом",
    ],
    robots: {
      index: true,
      follow: true,
      googleBot: {
        index: true,
        follow: true,
        "max-image-preview": "large",
        "max-snippet": -1,
        "max-video-preview": -1,
      },
    },
    verification,
    openGraph: {
      type: "website",
      siteName: "DC Bakery",
      title,
      description,
      url: `${SITE_URL}/${locale}`,
      locale: OG_LOCALE[locale],
      alternateLocale: LOCALES.filter((l) => l !== locale).map((l) => OG_LOCALE[l]),
      // Явно указываем OG-картинку: при заданном openGraph в layout файловый
      // opengraph-image автоматически НЕ подхватывается → превью в мессенджерах/соцсетях
      // было без изображения. Товарные страницы переопределяют своим фото.
      images: [{ url: `${SITE_URL}/opengraph-image`, width: 1200, height: 630, alt: "DC Bakery" }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [`${SITE_URL}/opengraph-image`],
    },
  };
}

export default async function LocaleLayout({
  children,
  params,
}: Readonly<{
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}>) {
  const { locale: raw } = await params;
  if (!isLocale(raw)) notFound();
  const locale = raw;
  // Активный словарь передаём пропом в LocaleProvider: на клиент уходит ТОЛЬКО он (ru → null),
  // а не оба словаря целиком в бандле. Layout не перемонтируется → отправляется один раз.
  const dictionary = getDictionary(locale);
  // Origin Supabase Storage (фото товаров) для раннего соединения. try/catch — на случай
  // некорректного значения env, чтобы не уронить рендер layout.
  let supabaseOrigin: string | null = null;
  try {
    if (process.env.NEXT_PUBLIC_SUPABASE_URL) {
      supabaseOrigin = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).origin;
    }
  } catch {
    supabaseOrigin = null;
  }

  return (
    <html lang={locale} className={`${fontVariables} h-full antialiased`}>
      <head>
        {/* Ранние соединения к сторонним хостам: экономят DNS+TCP+TLS до первого обращения
            (аналитика, фото товаров из Supabase). Условно по env — без ключей ничего не добавляем. */}
        {supabaseOrigin ? (
          <link rel="preconnect" href={supabaseOrigin} crossOrigin="anonymous" />
        ) : null}
        {process.env.NEXT_PUBLIC_GA_ID ? (
          <>
            <link rel="preconnect" href="https://www.googletagmanager.com" />
            <link rel="dns-prefetch" href="https://www.google-analytics.com" />
          </>
        ) : null}
        {process.env.NEXT_PUBLIC_YANDEX_METRICA_ID ? (
          <link rel="preconnect" href="https://mc.yandex.ru" crossOrigin="anonymous" />
        ) : null}
      </head>
      <body className="flex min-h-full flex-col">
        <Analytics />
        <RouteTracker />
        <LocaleProvider locale={locale} dictionary={dictionary}>
          <CartProvider>
            <ToastProvider>{children}</ToastProvider>
          </CartProvider>
        </LocaleProvider>
      </body>
    </html>
  );
}
