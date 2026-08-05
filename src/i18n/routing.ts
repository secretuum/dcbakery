import type { Metadata } from "next";
import { DEFAULT_LOCALE, HREFLANG, LOCALES, isLocale, type Locale } from "@/src/i18n/config";
import { SITE_URL } from "@/src/lib/site-url";

// Разделы БЕЗ языкового префикса (админка/апи/оплата/документы).
const NON_LOCALIZED = ["/admin", "/api", "/pay", "/documents"];

function isExternal(href: string): boolean {
  return /^(https?:|tel:|mailto:|#)/i.test(href);
}

function isNonLocalized(path: string): boolean {
  return NON_LOCALIZED.some((prefix) => path === prefix || path.startsWith(`${prefix}/`));
}

/**
 * Добавить языковой префикс к ВНУТРЕННЕМУ пути. Идемпотентно (не даёт /ru/ru/…),
 * пропускает внешние ссылки / tel / mailto / hash и не-локализуемые разделы,
 * сохраняет query и hash.
 */
export function withLocale(href: string, locale: Locale): string {
  if (!href || isExternal(href)) return href;
  const match = href.match(/^([^?#]*)([?#].*)?$/);
  const pathPart = match?.[1] || "/";
  const suffix = match?.[2] ?? "";
  if (isNonLocalized(pathPart)) return href;
  if (isLocale(pathPart.split("/")[1])) return href; // уже с префиксом
  const clean = pathPart === "/" ? "" : pathPart;
  return `/${locale}${clean}${suffix}`;
}

/** Снять языковой префикс с pathname (для active-state и переключателя языка). */
export function stripLocale(pathname: string): { locale: Locale; path: string } {
  const seg = pathname.split("/")[1];
  if (isLocale(seg)) {
    return { locale: seg, path: pathname.slice(seg.length + 1) || "/" };
  }
  return { locale: DEFAULT_LOCALE, path: pathname || "/" };
}

/**
 * canonical + hreflang alternates для страницы. `path` — путь БЕЗ языкового
 * префикса ("/optom", "/"). Возвращает объект для Next Metadata.alternates.
 */
export function buildAlternates(path: string, locale: Locale): Metadata["alternates"] {
  const clean = path === "/" ? "" : path;
  const languages: Record<string, string> = {};
  for (const l of LOCALES) languages[HREFLANG[l]] = `${SITE_URL}/${l}${clean}`;
  languages["x-default"] = `${SITE_URL}/${DEFAULT_LOCALE}${clean}`;
  return { canonical: `${SITE_URL}/${locale}${clean}`, languages };
}
