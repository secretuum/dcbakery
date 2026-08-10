// Шрифты вынесены из корневого layout в общий модуль: после B3 у сайта два корня
// (локализованный app/[locale] и не-локализованный app/(unlocalized)), и оба
// подключают одни и те же CSS-переменные шрифтов.
import { Geist, Montserrat, IBM_Plex_Mono } from "next/font/google";

export const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  display: "swap",
});

export const montserrat = Montserrat({
  variable: "--font-montserrat",
  subsets: ["latin", "cyrillic"],
  weight: ["500", "600", "700"],
  display: "swap",
});

// IBM Plex Mono — только «цифровой» акцент (цены, номера заказов, IBAN, даты), не
// критичный LCP-текст. preload:false убирает авто-генерируемый <link rel=preload> с
// каждой страницы, чтобы моно-шрифт не конкурировал за критический путь с Geist и
// LCP-картинкой. Шрифт всё равно самохостится и подгружается по требованию (display:swap).
export const ibmPlexMono = IBM_Plex_Mono({
  variable: "--font-ibm-plex-mono",
  subsets: ["latin", "cyrillic"],
  weight: ["400", "500", "600"],
  display: "swap",
  preload: false,
});

/** Классы CSS-переменных шрифтов для <html>. */
export const fontVariables = `${geistSans.variable} ${montserrat.variable} ${ibmPlexMono.variable}`;
