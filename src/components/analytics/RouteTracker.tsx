"use client";
// Пейджвью на клиентских переходах (App Router). Init-скрипты GA4/Метрики считают
// только первую загрузку; здесь досылаем page_view на каждую смену маршрута.
// pathname-only (без useSearchParams) — чтобы не опротестовать страницы в динамику.

import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";

const GA_ID = process.env.NEXT_PUBLIC_GA_ID;
const YANDEX_ID = process.env.NEXT_PUBLIC_YANDEX_METRICA_ID;

export function RouteTracker() {
  const pathname = usePathname();
  const isFirst = useRef(true);

  useEffect(() => {
    // Первый рендер уже учтён init-скриптами (gtag config / ym init) — не дублируем.
    if (isFirst.current) {
      isFirst.current = false;
      return;
    }
    try {
      if (GA_ID) {
        window.gtag?.("event", "page_view", {
          page_path: pathname,
          page_location: window.location.href,
        });
      }
    } catch {
      /* noop */
    }
    try {
      if (YANDEX_ID) window.ym?.(Number(YANDEX_ID), "hit", pathname);
    } catch {
      /* noop */
    }
  }, [pathname]);

  return null;
}
