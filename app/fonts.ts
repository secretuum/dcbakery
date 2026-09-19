// Шрифты вынесены из корневого layout в общий модуль: после B3 у сайта два корня
// (локализованный app/[locale] и не-локализованный app/(unlocalized)), и оба
// подключают одни и те же CSS-переменные шрифтов.
import { Montserrat, IBM_Plex_Mono } from "next/font/google";

// Montserrat — весь текст сайта: и заголовки (--font-display), и основной текст
// (--font-sans в globals.css). Раньше текст шёл Geist'ом, у которого подключена
// только латиница, поэтому русский и казахский рисовались запасным Arial.
//
// Массив weight намеренно не задан: Google отдаёт Montserrat одним вариативным
// woff2 на каждый subset (latin ~37 КБ, cyrillic ~24 КБ), и этот файл один и тот же
// для любого веса — при weight:["500","600","700"] скачивались ровно те же байты,
// просто в @font-face объявлялись три веса из девяти. Без weight объявляется весь
// диапазон 100–900 тем же весом файлов: бесплатно появляются 400 (font-normal и
// текст по умолчанию) и 800 (font-extrabold, 22 места — раньше браузер подделывал
// его из 700).
export const montserrat = Montserrat({
  variable: "--font-montserrat",
  subsets: ["latin", "cyrillic"],
  display: "swap",
});

// IBM Plex Mono — только «цифровой» акцент (цены, номера заказов, IBAN, даты), не
// критичный LCP-текст. preload:false убирает авто-генерируемый <link rel=preload> с
// каждой страницы, чтобы моно-шрифт не конкурировал за критический путь с Montserrat и
// LCP-картинкой. Шрифт всё равно самохостится и подгружается по требованию (display:swap).
export const ibmPlexMono = IBM_Plex_Mono({
  variable: "--font-ibm-plex-mono",
  subsets: ["latin", "cyrillic"],
  weight: ["400", "500", "600"],
  display: "swap",
  preload: false,
});

/** Классы CSS-переменных шрифтов для <html>. */
export const fontVariables = `${montserrat.variable} ${ibmPlexMono.variable}`;
