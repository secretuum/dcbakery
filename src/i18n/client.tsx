"use client";

import { createContext, useContext, type ReactNode } from "react";
import { DEFAULT_LOCALE, type Locale } from "@/src/i18n/config";
import { translate, type Translator } from "@/src/i18n/translate";

// Клиентская сторона i18n: язык приходит с сервера через провайдер в корневом
// layout, словари статически попадают в бандл (кэшируются браузером один раз).

const LocaleContext = createContext<Locale>(DEFAULT_LOCALE);

export function LocaleProvider({ locale, children }: { locale: Locale; children: ReactNode }) {
  return <LocaleContext.Provider value={locale}>{children}</LocaleContext.Provider>;
}

export function useLocale() {
  return useContext(LocaleContext);
}

/** Клиентский переводчик: const t = useT(); t("Каталог") */
export function useT(): Translator {
  const locale = useLocale();
  return (text, vars) => translate(locale, text, vars);
}
