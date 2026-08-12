import "server-only";
import { cookies } from "next/headers";
import { locale as rootLocale } from "next/root-params";
import { DEFAULT_LOCALE, LOCALE_COOKIE, isLocale, type Locale } from "@/src/i18n/config";
import { translate, type Translator } from "@/src/i18n/translate";

export async function getLocale(): Promise<Locale> {
  // Источник истины под сегментом [locale] — корневой параметр через next/root-params.
  // В отличие от headers()/cookies() он НЕ форсит динамику → страницы становятся
  // static/ISR-совместимыми. Значение резолвит компилятор Next из реального сегмента.
  try {
    const value = await rootLocale();
    if (isLocale(value)) return value;
  } catch {
    // Вне [locale] (route handlers, /pay, /documents) root-params недоступен — падаем
    // в cookie-фолбэк (NEXT_LOCALE кладёт middleware при заходе с языковым префиксом).
  }
  const value = (await cookies()).get(LOCALE_COOKIE)?.value;
  return isLocale(value) ? value : DEFAULT_LOCALE;
}

/**
 * Серверный переводчик: const t = await getT(); t("Каталог").
 * forceLocale фиксирует язык независимо от cookie посетителя — нужно для
 * клиентских документов (страница счёта/оплаты), которые должны быть на понятном
 * клиенту языке, а не на языке из чужой/старой cookie NEXT_LOCALE.
 */
export async function getT(forceLocale?: Locale): Promise<Translator> {
  const locale = forceLocale ?? (await getLocale());
  return (text, vars) => translate(locale, text, vars);
}
