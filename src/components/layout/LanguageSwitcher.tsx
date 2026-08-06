"use client";

import { usePathname, useRouter } from "next/navigation";
import { useState, useTransition } from "react";
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
  const [isPending, startTransition] = useTransition();
  const [target, setTarget] = useState<Locale | null>(null);

  function switchTo(next: Locale) {
    if (next === locale) return;
    // URL — источник истины: переходим на тот же путь под новым языковым префиксом.
    // Cookie — для персистентности выбора при заходе на «голый» URL.
    writeLocaleCookie(next);
    setTarget(next);
    // Смена языка = навигация с серверным рендером новой локали. useTransition даёт
    // индикатор ожидания, чтобы кнопка не выглядела «зависшей».
    const { path } = stripLocale(pathname);
    startTransition(() => router.push(withLocale(path, next)));
  }

  return (
    <div
      className={`flex items-center rounded border border-black/15 ${isPending ? "cursor-wait opacity-70" : ""}`}
      role="group"
      aria-label={t("Язык")}
      aria-busy={isPending}
    >
      {LOCALES.filter((item) => item !== "en").map((item) => (
        <button
          key={item}
          type="button"
          onClick={() => switchTo(item)}
          disabled={isPending}
          aria-pressed={item === locale}
          className={`px-2 py-1.5 text-xs font-bold uppercase transition first:rounded-l last:rounded-r disabled:cursor-wait ${
            item === locale
              ? "bg-dark text-white"
              : "text-muted hover:bg-black/5 hover:text-dark"
          }`}
        >
          {isPending && target === item ? "…" : localeLabels[item]}
        </button>
      ))}
    </div>
  );
}
