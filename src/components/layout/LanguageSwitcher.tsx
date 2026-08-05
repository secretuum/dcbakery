"use client";

import { usePathname, useRouter } from "next/navigation";
import { LOCALE_COOKIE, LOCALES, localeLabels, type Locale } from "@/src/i18n/config";
import { useLocale, useT } from "@/src/i18n/client";
import { stripLocale, withLocale } from "@/src/i18n/routing";

function writeLocaleCookie(next: string) {
  document.cookie = `${LOCALE_COOKIE}=${next}; path=/; max-age=31536000; samesite=lax`;
}

export function LanguageSwitcher() {
  const router = useRouter();
  const pathname = usePathname();
  const locale = useLocale();
  const t = useT();

  function switchTo(next: Locale) {
    // URL — источник истины: переходим на тот же путь под новым языковым префиксом.
    // Cookie — для персистентности выбора при заходе на «голый» URL.
    writeLocaleCookie(next);
    const { path } = stripLocale(pathname);
    router.push(withLocale(path, next));
  }

  return (
    <div className="flex items-center rounded border border-black/15" role="group" aria-label={t("Язык")}>
      {LOCALES.map((item) => (
        <button
          key={item}
          type="button"
          onClick={() => switchTo(item)}
          aria-pressed={item === locale}
          className={`px-2 py-1.5 text-xs font-bold uppercase transition first:rounded-l last:rounded-r ${
            item === locale
              ? "bg-dark text-white"
              : "text-muted hover:bg-black/5 hover:text-dark"
          }`}
        >
          {localeLabels[item]}
        </button>
      ))}
    </div>
  );
}
