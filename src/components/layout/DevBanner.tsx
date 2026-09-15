"use client";

import { DEV_BANNER_ENABLED, REGISTRATION_OPEN, WHATSAPP_SUPPORT_NUMBER } from "@/app/constants";
import { useT } from "@/src/i18n/client";

// Плашка «Сайт в разработке» над шапкой. Без состояния — рендерится на сервере вместе
// со страницей (ISR не ломает). data-nosnippet — чтобы текст не попадал в сниппеты поиска.
export function DevBanner() {
  const t = useT();

  if (!DEV_BANNER_ENABLED) return null;

  return (
    <div
      role="status"
      data-nosnippet
      className="print-hidden bg-espresso px-5 py-2 text-center text-[13px] font-medium leading-5 text-white"
    >
      {t("Сайт в разработке.")}
      {REGISTRATION_OPEN ? null : <> {t("Регистрация новых клиентов временно закрыта.")}</>}{" "}
      <a
        href={`https://wa.me/${WHATSAPP_SUPPORT_NUMBER}`}
        target="_blank"
        rel="noopener noreferrer"
        className="whitespace-nowrap font-semibold underline underline-offset-2 hover:opacity-80"
      >
        {t("Написать в WhatsApp")}
      </a>
    </div>
  );
}
