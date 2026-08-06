"use client";

import { usePathname } from "next/navigation";
import { useState } from "react";
import { LOCALE_COOKIE, LOCALES, localeLabels, type Locale } from "@/src/i18n/config";
import { useLocale, useT } from "@/src/i18n/client";
import { stripLocale, withLocale } from "@/src/i18n/routing";

function writeLocaleCookie(next: string) {
  document.cookie = `${LOCALE_COOKIE}=${next}; path=/; max-age=31536000; samesite=lax`;
}

export function LanguageSwitcher() {
  const pathname = usePathname();
  const locale = useLocale();
  const t = useT();
  const [target, setTarget] = useState<Locale | null>(null);
  const switching = target !== null;

  function switchTo(next: Locale) {
    if (next === locale || switching) return;
    // Cookie — для персистентности выбора при заходе на «голый» URL.
    writeLocaleCookie(next);
    setTarget(next);

    const { path } = stripLocale(pathname);

    // ВАЖНО: полная навигация (window.location), а НЕ router.push. Язык у нас живёт
    // только в префиксе URL, который middleware (proxy.ts) переписывает в заголовок
    // x-locale — отдельного сегмента [locale] в дереве маршрутов НЕТ. При client-side
    // router.push Next видит, что /kk и /ru ведут на одну и ту же ветку маршрутов,
    // переиспользует закэшированные общие layout-ы (в корневом layout сидят
    // LocaleProvider и <html lang>) и НЕ перерисовывает их под новый язык — из-за
    // этого переключатель «не срабатывал». Жёсткая перезагрузка гарантирует, что
    // сервер отрендерит всю страницу на выбранном языке.
    window.location.assign(withLocale(path, next));
  }

  return (
    <div
      className={`flex items-center rounded border border-black/15 ${switching ? "cursor-wait opacity-70" : ""}`}
      role="group"
      aria-label={t("Язык")}
      aria-busy={switching}
    >
      {LOCALES.filter((item) => item !== "en").map((item) => (
        <button
          key={item}
          type="button"
          onClick={() => switchTo(item)}
          disabled={switching}
          aria-pressed={item === locale}
          className={`px-2 py-1.5 text-xs font-bold uppercase transition first:rounded-l last:rounded-r disabled:cursor-wait ${
            item === locale
              ? "bg-dark text-white"
              : "text-muted hover:bg-black/5 hover:text-dark"
          }`}
        >
          {switching && target === item ? "…" : localeLabels[item]}
        </button>
      ))}
    </div>
  );
}
