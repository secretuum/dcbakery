"use client";

import { useRouter } from "next/navigation";
import { LOCALES, LOCALE_COOKIE, localeLabels } from "@/src/i18n/config";
import { useLocale } from "@/src/i18n/client";

function writeLocaleCookie(next: string) {
  document.cookie = `${LOCALE_COOKIE}=${next}; path=/; max-age=31536000; samesite=lax`;
}

export function LanguageSwitcher() {
  const router = useRouter();
  const locale = useLocale();

  function switchTo(next: string) {
    writeLocaleCookie(next);
    router.refresh();
  }

  return (
    <div className="flex items-center rounded border border-black/15" role="group" aria-label="Язык">
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
