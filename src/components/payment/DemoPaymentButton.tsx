"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type DemoPaymentButtonProps = {
  orderId: string;
  paymentToken: string;
};

export function DemoPaymentButton({ orderId, paymentToken }: DemoPaymentButtonProps) {
  const router = useRouter();
  const [cardNumber, setCardNumber] = useState("4111 1111 1111 1111");
  const [expiry, setExpiry] = useState("12/30");
  const [cvc, setCvc] = useState("123");
  const [state, setState] = useState<"error" | "idle" | "paying" | "success">("idle");

  async function handlePayment(outcome: "failed" | "paid") {
    setState("paying");

    try {
      const response = await fetch("/api/payments/demo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId, outcome, paymentToken }),
      });

      if (!response.ok) {
        throw new Error("Demo payment failed");
      }

      setState(outcome === "paid" ? "success" : "error");
      router.refresh();
    } catch {
      setState("error");
    }
  }

  return (
    <div className="rounded-card border-2 border-dashed border-coral bg-coral-light p-5">
      <p className="text-xs font-black uppercase text-burgundy">Демо-шлюз</p>
      <p className="mt-2 text-sm font-semibold leading-6 text-dark">
        Используйте только тестовые данные. Деньги не списываются.
      </p>

      <div className="mt-4 grid gap-3">
        <label>
          <span className="text-xs font-black uppercase text-muted">Номер карты</span>
          <input
            className="mt-1 min-h-12 w-full rounded-xl border border-black/10 bg-white px-4 font-bold outline-none focus:border-coral"
            inputMode="numeric"
            value={cardNumber}
            onChange={(event) => setCardNumber(event.currentTarget.value)}
          />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label>
            <span className="text-xs font-black uppercase text-muted">Срок</span>
            <input
              className="mt-1 min-h-12 w-full rounded-xl border border-black/10 bg-white px-4 font-bold outline-none focus:border-coral"
              value={expiry}
              onChange={(event) => setExpiry(event.currentTarget.value)}
            />
          </label>
          <label>
            <span className="text-xs font-black uppercase text-muted">CVC</span>
            <input
              className="mt-1 min-h-12 w-full rounded-xl border border-black/10 bg-white px-4 font-bold outline-none focus:border-coral"
              inputMode="numeric"
              value={cvc}
              onChange={(event) => setCvc(event.currentTarget.value)}
            />
          </label>
        </div>
      </div>

      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        <button
          className="min-h-12 rounded-btn bg-coral px-5 py-3 text-sm font-black text-white transition hover:bg-coral-hover disabled:opacity-50"
          disabled={state === "paying" || state === "success"}
          type="button"
          onClick={() => handlePayment("paid")}
        >
          {state === "paying"
            ? "Обрабатываем..."
            : state === "success"
              ? "Оплата проведена"
              : "Оплатить"}
        </button>
        <button
          className="min-h-12 rounded-btn bg-white px-5 py-3 text-sm font-black text-burgundy ring-1 ring-burgundy/20 transition hover:bg-[#fff1f2] disabled:opacity-50"
          disabled={state === "paying" || state === "success"}
          type="button"
          onClick={() => handlePayment("failed")}
        >
          Симулировать отказ
        </button>
      </div>
      {state === "error" ? (
        <p className="mt-3 text-xs font-bold text-burgundy">
          Оплата не прошла. Деньги не списаны, можно попробовать еще раз.
        </p>
      ) : null}
    </div>
  );
}
