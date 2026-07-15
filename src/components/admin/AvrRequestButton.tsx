"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type AvrRequestButtonProps = {
  orderId: string;
  requested: boolean;
};

export function AvrRequestButton({ orderId, requested }: AvrRequestButtonProps) {
  const router = useRouter();
  const [isSaving, setIsSaving] = useState(false);
  const [hasError, setHasError] = useState(false);

  async function handleClick() {
    setIsSaving(true);
    setHasError(false);

    try {
      const response = await fetch(`/api/admin/orders/${orderId}/avr`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requestAvr: !requested }),
      });

      if (!response.ok) {
        throw new Error("Failed to update AVR request");
      }

      router.refresh();
    } catch {
      setHasError(true);
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="mt-3">
      <button
        className="w-full rounded-btn border border-black/10 bg-cream px-4 py-3 text-sm font-semibold text-dark transition hover:bg-coral-light disabled:opacity-50"
        disabled={isSaving}
        type="button"
        onClick={handleClick}
      >
        {isSaving
          ? "Сохраняю..."
          : requested
            ? "Убрать запрос АВР"
            : "Добавить АВР к заказу"}
      </button>
      {hasError ? (
        <p className="mt-2 text-xs font-semibold text-burgundy">
          Не удалось изменить запрос АВР. Проверьте миграцию базы.
        </p>
      ) : null}
    </div>
  );
}
