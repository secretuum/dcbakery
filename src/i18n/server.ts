import "server-only";
import { cookies } from "next/headers";
import { DEFAULT_LOCALE, LOCALE_COOKIE, isLocale, type Locale } from "@/src/i18n/config";
import { translate, type Translator } from "@/src/i18n/translate";

export async function getLocale(): Promise<Locale> {
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
