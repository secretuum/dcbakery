"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function CancelOrderForm({
  disabled,
  orderId,
}: {
  disabled?: boolean;
  orderId: string;
}) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [reason, setReason] = useState("");
  const [status, setStatus] = useState<"error" | "idle" | "success">("idle");

  async function handleCancel() {
    if (disabled || isSubmitting) {
      return;
    }

    setIsSubmitting(true);
    setStatus("idle");

    const response = await fetch(`/api/admin/orders/${orderId}/cancel`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ reason }),
    });

    setIsSubmitting(false);

    if (!response.ok) {
      setStatus("error");
      return;
    }

    setStatus("success");
    router.refresh();
  }

  return (
    <div className="mt-4 rounded-btn border border-black/5 bg-cream px-4 py-3">
      <p className="text-xs font-semibold uppercase tracking-[.08em] text-muted">Отмена</p>
      <textarea
        value={reason}
        onChange={(event) => setReason(event.currentTarget.value)}
        placeholder="Причина отмены для клиента"
        rows={3}
        disabled={disabled || isSubmitting}
        className="mt-2 w-full rounded-btn border border-black/10 bg-white px-3 py-2 text-sm font-medium outline-none focus:border-coral focus:ring-2 focus:ring-coral/20 disabled:opacity-60"
      />
      <button
        type="button"
        disabled={disabled || isSubmitting}
        onClick={handleCancel}
        className="mt-3 inline-flex min-h-10 w-full items-center justify-center rounded-btn border border-dark bg-dark px-4 py-2 text-sm font-semibold text-white transition hover:bg-burgundy disabled:cursor-not-allowed disabled:opacity-50"
      >
        {isSubmitting ? "Отменяю..." : "Отменить заявку"}
      </button>
      {status === "success" ? (
        <p className="mt-2 text-xs font-semibold text-raspberry">Заявка отменена</p>
      ) : null}
      {status === "error" ? (
        <p className="mt-2 text-xs font-semibold text-burgundy">Не удалось отменить</p>
      ) : null}
    </div>
  );
}
