"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/src/components/ui/Button";
import { useToast } from "@/src/contexts/ToastContext";
import type { OrderStatus, PaymentStatus } from "@/src/types";

type UnmarkOrderPaidButtonProps = {
  orderId: string;
  paymentStatus?: PaymentStatus | null;
  status: OrderStatus;
};

export function UnmarkOrderPaidButton({
  orderId,
  paymentStatus,
  status,
}: UnmarkOrderPaidButtonProps) {
  const router = useRouter();
  const { showToast } = useToast();
  const [isSaving, setIsSaving] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);
  // Снять можно, только пока заказ не ушёл дальше «оплачен»
  const canUnmark = paymentStatus === "paid" && status === "paid";

  async function handleUnmark() {
    setIsSaving(true);

    try {
      const response = await fetch(`/api/admin/orders/${orderId}/unmark-paid`, {
        method: "POST",
      });
      const body = (await response.json().catch(() => ({}))) as { error?: string };

      if (!response.ok) {
        throw new Error(body.error || "Не удалось снять отметку");
      }

      showToast("Отметка оплаты снята, заказ снова ждёт оплаты", "success");
      setIsConfirming(false);
      router.refresh();
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Не удалось снять отметку", "error");
    } finally {
      setIsSaving(false);
    }
  }

  if (!canUnmark) {
    return null;
  }

  if (!isConfirming) {
    return (
      <Button
        className="mt-3 w-full bg-white text-muted ring-1 ring-black/10 hover:bg-black/5"
        onClick={() => setIsConfirming(true)}
        variant="ghost"
      >
        Снять отметку оплаты…
      </Button>
    );
  }

  return (
    <div className="mt-3 rounded-btn border border-burgundy/30 bg-coral-light p-3">
      <p className="text-xs font-semibold leading-5 text-burgundy">
        Заказ вернётся в «Ждет оплаты», дата оплаты очистится. Действие попадёт в журнал
        с вашим email.
      </p>
      <div className="mt-3 flex gap-2">
        <Button
          className="flex-1 bg-burgundy text-white hover:bg-burgundy/85"
          disabled={isSaving}
          onClick={handleUnmark}
          variant="ghost"
        >
          {isSaving ? "Снимаем..." : "Подтвердить"}
        </Button>
        <Button
          className="flex-1 bg-white text-dark ring-1 ring-black/10 hover:bg-black/5"
          disabled={isSaving}
          onClick={() => setIsConfirming(false)}
          variant="ghost"
        >
          Отмена
        </Button>
      </div>
    </div>
  );
}
