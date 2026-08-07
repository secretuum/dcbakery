import type { Metadata, Viewport } from "next";
import { Geist, Montserrat, IBM_Plex_Mono } from "next/font/google";
import { CartProvider } from "@/src/contexts/CartContext";
import { ToastProvider } from "@/src/contexts/ToastContext";
import { LocaleProvider } from "@/src/i18n/client";
import { LOCALES, OG_LOCALE } from "@/src/i18n/config";
import { getLocale, getT } from "@/src/i18n/server";
import { SITE_URL } from "@/src/lib/site-url";
import { Analytics } from "@/src/components/analytics/Analytics";
import { RouteTracker } from "@/src/components/analytics/RouteTracker";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  display: "swap",
});

const montserrat = Montserrat({
  variable: "--font-montserrat",
  subsets: ["latin", "cyrillic"],
  weight: ["500", "600", "700"],
  display: "swap",
});

const ibmPlexMono = IBM_Plex_Mono({
  variable: "--font-ibm-plex-mono",
  subsets: ["latin", "cyrillic"],
  weight: ["400", "500", "600"],
  display: "swap",
});


export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

const SITE_TITLE = "DC Bakery — B2B кондитерская и полуфабрикаты, Алматы";
const SITE_DESCRIPTION =
  "B2B-каталог десертов, полуфабрикатов и мяса для кофеен, ресторанов, магазинов и отелей.";

// Верификация вебмастеров (Google Search Console / Яндекс.Вебмастер / Bing) — через
// env, чтобы подключить без правки кода. Bing — через other.msvalidate.01.
const verification: NonNullable<Metadata["verification"]> = {};
if (process.env.GOOGLE_SITE_VERIFICATION) verification.google = process.env.GOOGLE_SITE_VERIFICATION;
if (process.env.YANDEX_VERIFICATION) verification.yandex = process.env.YANDEX_VERIFICATION;
if (process.env.BING_VERIFICATION) verification.other = { "msvalidate.01": process.env.BING_VERIFICATION };

// Метаданные СЧИТАЮТСЯ НА ЗАПРОС, а не статически: заголовок, описание и og:locale
// обязаны совпадать с языком страницы. Раньше здесь был `export const metadata` с
// русскими строками и жёстким og:locale="kk_KZ" — то есть на /kk и /en в выдачу
// уходил русский заголовок, а на /ru Open Graph объявлял себя казахским.
export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  const t = await getT();
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
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
    },
  };
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const locale = await getLocale();
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
    <html
      lang={locale}
      className={`${geistSans.variable} ${montserrat.variable} ${ibmPlexMono.variable} h-full antialiased`}
    >
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
        <LocaleProvider locale={locale}>
          <CartProvider>
            <ToastProvider>
              {children}
            </ToastProvider>
          </CartProvider>
        </LocaleProvider>
      </body>
    </html>
  );
}
