"use client";

import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
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
  const [target, setTarget] = useState<Locale | null>(null);
  const switching = target !== null;

  function switchTo(next: Locale) {
    if (next === locale || switching) return;
    // Cookie — для персистентности выбора при заходе на «голый» URL.
    writeLocaleCookie(next);

    const { path } = stripLocale(pathname);
    // usePathname() отдаёт путь БЕЗ ?query и #hash — дописываем их вручную, иначе
    // смена языка теряет параметры. Это не косметика: на /register?rt=<токен> (ссылка
    // из WhatsApp) потеря query убивает одноразовый токен, и клиент видит «ссылка
    // недействительна»; на /order-success теряются номер и сумма заказа.
    // withLocale сам отделит путь от суффикса.
    const target = withLocale(path + window.location.search + window.location.hash, next);

    // Нелокализуемые разделы (/admin, /api, /pay, /documents): withLocale вернёт тот же
    // путь. Перезагружать страницу там незачем (в админке это ещё и потеряет
    // заполненную форму) — достаточно записать cookie и обновить серверную разметку.
    if (target === window.location.pathname + window.location.search + window.location.hash) {
      router.refresh();
      return;
    }

    setTarget(next);
    // ВАЖНО: полная навигация (window.location), а НЕ router.push. Язык живёт в реальном
    // корневом сегменте [locale], у которого свой root-layout с <html lang> и
    // LocaleProvider. Жёсткая перезагрузка гарантирует, что сервер отрендерит страницу
    // целиком на выбранном языке (и сменит <html lang>), без клиентских артефактов кэша.
    window.location.assign(target);
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
