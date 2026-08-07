"use client";

import { createContext, useContext, type ReactNode } from "react";
import { DEFAULT_LOCALE, type Locale } from "@/src/i18n/config";
import { translateWith, type Dictionary, type Translator } from "@/src/i18n/translate-core";

// Клиентская сторона i18n: язык И активный словарь приходят с сервера через провайдер в
// корневом layout. Сами словари в клиентский бандл НЕ попадают (translate-core без JSON);
// активный словарь передан пропом. Корневой layout не перемонтируется при клиентской
// навигации → словарь уходит один раз, а не на каждый переход.

const LocaleContext = createContext<Locale>(DEFAULT_LOCALE);
const DictionaryContext = createContext<Dictionary>(null);

export function LocaleProvider({
  locale,
  dictionary,
  children,
}: {
  locale: Locale;
  dictionary: Dictionary;
  children: ReactNode;
}) {
  return (
    <LocaleContext.Provider value={locale}>
      <DictionaryContext.Provider value={dictionary}>{children}</DictionaryContext.Provider>
    </LocaleContext.Provider>
  );
}

export function useLocale() {
  return useContext(LocaleContext);
}

/** Клиентский переводчик: const t = useT(); t("Каталог") */
export function useT(): Translator {
  const dictionary = useContext(DictionaryContext);
  return (text, vars) => translateWith(dictionary, text, vars);
}
