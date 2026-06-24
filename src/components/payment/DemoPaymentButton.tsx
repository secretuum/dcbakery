"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type DemoPaymentButtonProps = {
  orderId: string;
  paymentId: string;
};

export function DemoPaymentButton({ orderId, paymentId }: DemoPaymentButtonProps) {
  const router = useRouter();
  const [state, setState] = useState<"error" | "idle" | "paying" | "success">("idle");

  async function handlePayment() {
    setState("paying");

    try {
      const response = await fetch("/api/payments/demo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId, paymentId }),
      });

      if (!response.ok) {
        throw new Error("Demo payment failed");
      }

      setState("success");
      router.refresh();
    } catch {
      setState("error");
    }
  }

  return (
    <div className="rounded-card border-2 border-dashed border-coral bg-coral-light p-5">
      <p className="text-xs font-black uppercase text-burgundy">Демо-шлюз</p>
      <p className="mt-2 text-sm font-semibold leading-6 text-dark">
        Деньги не списываются. Кнопка только имитирует успешный webhook банка.
      </p>
      <button
        className="mt-4 min-h-12 w-full rounded-btn bg-coral px-5 py-3 text-sm font-black text-white transition hover:bg-coral-hover disabled:opacity-50"
        disabled={state === "paying" || state === "success"}
        type="button"
        onClick={handlePayment}
      >
        {state === "paying"
          ? "Эмулируем оплату..."
          : state === "success"
            ? "Оплата проведена"
            : "Эмулировать успешную оплату"}
      </button>
      {state === "error" ? (
        <p className="mt-3 text-xs font-bold text-burgundy">
          Эмуляция не сработала. Проверьте PAYMENT_MODE=demo.
        </p>
      ) : null}
    </div>
  );
}
