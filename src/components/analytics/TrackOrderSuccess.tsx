"use client";
// Отправляет конверсию «purchase» (заказ оформлен) в GA4 и Яндекс.Метрику при показе
// страницы успеха. Сумму сюда не передаём (её нет на странице) — это ключевое событие
// воронки; стоимость добавим, когда прокинем итог заказа в редирект.

import { useEffect } from "react";
import { trackEvent } from "@/src/lib/analytics";

export function TrackOrderSuccess({ orderNumber }: { orderNumber: string }) {
  useEffect(() => {
    // "DCB" — плейсхолдер, когда номера в URL нет: не засоряем конверсии.
    if (!orderNumber || orderNumber === "DCB") return;
    trackEvent("purchase", { transaction_id: orderNumber });
  }, [orderNumber]);
  return null;
}
