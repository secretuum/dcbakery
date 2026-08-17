"use client";

import { useSyncExternalStore } from "react";
import { LocaleLink } from "@/src/i18n/LocaleLink";
import { useT } from "@/src/i18n/client";

// Ненавязчивый баннер о cookie: показывается один раз до согласия, выбор хранится
// в localStorage (сервер ничего не пишет). Читаем через useSyncExternalStore, чтобы
// не мигать при гидратации и не форсить динамику страниц (ISR не ломаем).
const CONSENT_KEY = "dc_cookie_consent";
const listeners = new Set<() => void>();

function isAccepted(): boolean {
  try {
    return localStorage.getItem(CONSENT_KEY) !== null;
  } catch {
    // localStorage недоступен (приватный режим/блокировка) — не навязываем баннер
    return true;
  }
}

function subscribe(onChange: () => void) {
  listeners.add(onChange);
  return () => {
    listeners.delete(onChange);
  };
}

function accept() {
  try {
    localStorage.setItem(CONSENT_KEY, "1");
  } catch {
    // не удалось сохранить — всё равно скрываем баннер
  }
  listeners.forEach((notify) => notify());
}

export function CookieConsent() {
  const t = useT();
  // На сервере и в первом кадре считаем «согласие есть» (ничего не рисуем), после
  // гидратации клиентский снимок покажет реальное состояние localStorage.
  const accepted = useSyncExternalStore(subscribe, isAccepted, () => true);

  if (accepted) return null;

  return (
    <div
      role="region"
      aria-label={t("Уведомление о cookie")}
      className="print-hidden fixed inset-x-3 bottom-[76px] z-50 rounded-2xl bg-white p-4 shadow-lg ring-1 ring-black/10 lg:inset-x-auto lg:bottom-4 lg:left-4 lg:max-w-sm"
      style={{ marginBottom: "env(safe-area-inset-bottom)" }}
    >
      <p className="text-sm leading-6 text-dark">
        {t(
          "Мы используем файлы cookie, чтобы сайт работал корректно и был удобнее. Продолжая пользоваться сайтом, вы соглашаетесь с их использованием.",
        )}{" "}
        <LocaleLink
          href="/privacy"
          className="font-semibold text-coral underline underline-offset-2 hover:opacity-80"
        >
          {t("Политика конфиденциальности")}
        </LocaleLink>
      </p>
      <div className="mt-3 flex justify-end">
        <button
          type="button"
          onClick={accept}
          className="rounded-full bg-coral px-6 py-2 text-sm font-semibold text-white transition hover:opacity-90"
        >
          {t("Принять")}
        </button>
      </div>
    </div>
  );
}
