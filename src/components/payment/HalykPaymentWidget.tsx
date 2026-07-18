"use client";

import { useCallback, useEffect, useRef, useState } from "react";

// Виджет платёжной страницы Halyk ePay: подключает их JS-библиотеку и вызывает
// halyk.pay(paymentObject). В браузер попадает только одноразовый token-объект
// (auth) — ClientSecret остаётся на сервере.

type HalykPaymentWidgetProps = {
  jsUrl: string;
  paymentObject: Record<string, unknown>;
};

declare global {
  interface Window {
    halyk?: { pay: (paymentObject: Record<string, unknown>) => void };
  }
}

export function HalykPaymentWidget({ jsUrl, paymentObject }: HalykPaymentWidgetProps) {
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const startedRef = useRef(false);

  const startPayment = useCallback(() => {
    if (!window.halyk) {
      setState("error");
      return;
    }

    window.halyk.pay(paymentObject);
  }, [paymentObject]);

  useEffect(() => {
    const script = document.createElement("script");
    script.src = jsUrl;
    script.async = true;
    script.onload = () => {
      setState("ready");
      // Открываем платёжную страницу сразу — клиент пришёл сюда платить
      if (!startedRef.current) {
        startedRef.current = true;
        startPayment();
      }
    };
    script.onerror = () => setState("error");
    document.body.appendChild(script);

    return () => {
      script.remove();
    };
  }, [jsUrl, startPayment]);

  if (state === "error") {
    return (
      <p className="rounded-btn bg-raspberry/10 px-4 py-3 text-sm font-semibold text-raspberry">
        Не удалось загрузить платёжную страницу банка. Обновите страницу или попробуйте позже.
      </p>
    );
  }

  return (
    <div className="rounded-card border border-black/10 bg-white p-5 text-center">
      <p className="text-sm font-semibold text-muted">
        {state === "loading" ? "Загружаем защищённую платёжную страницу банка…" : "Платёжная страница открыта."}
      </p>
      {state === "ready" ? (
        <button
          type="button"
          onClick={startPayment}
          className="mt-4 inline-flex min-h-12 items-center justify-center rounded-btn border border-coral bg-coral px-6 py-3 text-sm font-bold text-white transition hover:bg-coral-hover"
        >
          Открыть оплату ещё раз
        </button>
      ) : null}
    </div>
  );
}
