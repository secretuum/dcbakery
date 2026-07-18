import type { Metadata, Viewport } from "next";
import { Geist, Montserrat, IBM_Plex_Mono } from "next/font/google";
import { CartProvider } from "@/src/contexts/CartContext";
import { ToastProvider } from "@/src/contexts/ToastContext";
import { LocaleProvider } from "@/src/i18n/client";
import { getLocale } from "@/src/i18n/server";
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

export const metadata: Metadata = {
  title: "DC Bakery",
  description: "B2B-каталог десертов, полуфабрикатов и мяса для кофеен, ресторанов, магазинов и отелей.",
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
