"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/src/components/ui/Button";
import { useToast } from "@/src/contexts/ToastContext";
import type { OrderStatus } from "@/src/types";

const confirmableStatuses: OrderStatus[] = [
  "pending_manager_confirmation",
  "new",
  "confirmed",
];

type ConfirmOrderButtonProps = {
  orderId: string;
  status: OrderStatus;
};

export function ConfirmOrderButton({ orderId, status }: ConfirmOrderButtonProps) {
  const router = useRouter();
  const { showToast } = useToast();
  const [isConfirming, setIsConfirming] = useState(false);
  const canConfirm = confirmableStatuses.includes(status);

  async function handleConfirm() {
    setIsConfirming(true);

    try {
      const response = await fetch(`/api/admin/orders/${orderId}/confirm`, {
        method: "POST",
      });

      if (!response.ok) {
        throw new Error("Failed to confirm order");
      }

      showToast("Заказ подтвержден, ссылка подготовлена", "success");
      router.refresh();
    } catch {
      showToast("Не удалось подтвердить заказ", "error");
    } finally {
      setIsConfirming(false);
    }
  }

  if (!canConfirm) {
    return null;
  }

  return (
    <Button className="mt-4 w-full" disabled={isConfirming} onClick={handleConfirm}>
      {isConfirming ? "Подтверждаем..." : "Подтвердить заказ"}
    </Button>
  );
}
