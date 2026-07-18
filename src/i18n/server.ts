import "server-only";
import { cookies } from "next/headers";
import { DEFAULT_LOCALE, LOCALE_COOKIE, isLocale, type Locale } from "@/src/i18n/config";
import { translate, type Translator } from "@/src/i18n/translate";

export async function getLocale(): Promise<Locale> {
  const value = (await cookies()).get(LOCALE_COOKIE)?.value;
  return isLocale(value) ? value : DEFAULT_LOCALE;
}

/** Серверный переводчик: const t = await getT(); t("Каталог") */
export async function getT(): Promise<Translator> {
  const locale = await getLocale();
  return (text, vars) => translate(locale, text, vars);
}
