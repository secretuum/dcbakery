import type { Metadata, Viewport } from "next";
import { CartProvider } from "@/src/contexts/CartContext";
import { ToastProvider } from "@/src/contexts/ToastContext";
import { LocaleProvider } from "@/src/i18n/client";
import { getDictionary } from "@/src/i18n/translate";
import { SITE_URL } from "@/src/lib/site-url";
import { Analytics } from "@/src/components/analytics/Analytics";
import { fontVariables } from "@/app/fonts";
import "@/app/globals.css";

// Корень НЕ-локализованных разделов: /admin, /pay, /documents. Всегда lang="ru"
// (эти интерфейсы русскоязычные), без публичных Header/Footer/BottomNav и без
// редактора сайта — у них своя «оболочка» (AdminShell, макет счёта/оплаты).
// LocaleProvider(ru) держим как невидимую страховку: словарь ru = null (нулевой вес),
// но контекст есть — любой клиентский useT() не упадёт вне [locale].

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: "DC Bakery",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function UnlocalizedLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  let supabaseOrigin: string | null = null;
  try {
    if (process.env.NEXT_PUBLIC_SUPABASE_URL) {
      supabaseOrigin = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).origin;
    }
  } catch {
    supabaseOrigin = null;
  }

  return (
    <html lang="ru" className={`${fontVariables} h-full antialiased`}>
      <head>
        {supabaseOrigin ? (
          <link rel="preconnect" href={supabaseOrigin} crossOrigin="anonymous" />
        ) : null}
        {process.env.NEXT_PUBLIC_GA_ID ? (
          <>
            <link rel="preconnect" href="https://www.googletagmanager.com" />
            <link rel="dns-prefetch" href="https://www.google-analytics.com" />
          </>
        ) : null}
      </head>
      <body className="flex min-h-full flex-col">
        <Analytics />
        <LocaleProvider locale="ru" dictionary={getDictionary("ru")}>
          <CartProvider>
            <ToastProvider>{children}</ToastProvider>
          </CartProvider>
        </LocaleProvider>
      </body>
    </html>
  );
}
