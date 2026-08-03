import type { Metadata, Viewport } from "next";
import { Geist, Montserrat, IBM_Plex_Mono } from "next/font/google";
import { CartProvider } from "@/src/contexts/CartContext";
import { ToastProvider } from "@/src/contexts/ToastContext";
import { LocaleProvider } from "@/src/i18n/client";
import { getLocale } from "@/src/i18n/server";
import { SITE_URL } from "@/src/lib/site-url";
import { Analytics } from "@/src/components/analytics/Analytics";
import { RouteTracker } from "@/src/components/analytics/RouteTracker";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
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

// Верификация вебмастеров (Google Search Console / Яндекс.Вебмастер) — через env,
// чтобы подключить аналитику и рекламу без правки кода.
const verification: NonNullable<Metadata["verification"]> = {};
if (process.env.GOOGLE_SITE_VERIFICATION) verification.google = process.env.GOOGLE_SITE_VERIFICATION;
if (process.env.YANDEX_VERIFICATION) verification.yandex = process.env.YANDEX_VERIFICATION;

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: SITE_TITLE,
  description: SITE_DESCRIPTION,
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
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    url: SITE_URL,
    locale: "kk_KZ",
    alternateLocale: ["ru_RU", "en_US"],
  },
  twitter: {
    card: "summary_large_image",
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const locale = await getLocale();

  return (
    <html
      lang={locale}
      className={`${geistSans.variable} ${montserrat.variable} ${ibmPlexMono.variable} h-full antialiased`}
    >
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
