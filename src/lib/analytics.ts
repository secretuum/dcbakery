// Клиентские события аналитики: одним вызовом шлём и в GA4 (gtag), и в Яндекс.Метрику
// (reachGoal). ID берутся из env (NEXT_PUBLIC_*). Безопасно вызывать где угодно —
// если счётчиков нет или это сервер, вызов просто ничего не делает.

import type { Product } from "@/src/types";

type EventParams = Record<string, unknown>;

/** Позиция в формате GA4 ecommerce (item_id/item_name/price/quantity). */
export function gaItem(product: Product, quantity: number) {
  return { item_id: product.id, item_name: product.name, price: product.price, quantity };
}

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
    ym?: (...args: unknown[]) => void;
  }
}

const YANDEX_ID = process.env.NEXT_PUBLIC_YANDEX_METRICA_ID;

/** Отправить конверсию/событие в GA4 и Яндекс.Метрику. Никогда не бросает. */
export function trackEvent(name: string, params: EventParams = {}): void {
  if (typeof window === "undefined") return;
  try {
    window.gtag?.("event", name, params);
  } catch {
    /* noop */
  }
  try {
    if (YANDEX_ID) window.ym?.(Number(YANDEX_ID), "reachGoal", name, params);
  } catch {
    /* noop */
  }
}
