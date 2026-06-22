"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/src/components/ui/Button";
import { useToast } from "@/src/contexts/ToastContext";
import type { OrderStatus, PaymentStatus } from "@/src/types";

type MarkOrderPaidButtonProps = {
  orderId: string;
  paymentStatus?: PaymentStatus | null;
  status: OrderStatus;
};

export function MarkOrderPaidButton({ orderId, paymentStatus, status }: MarkOrderPaidButtonProps) {
  const router = useRouter();
  const { showToast } = useToast();
  const [isSaving, setIsSaving] = useState(false);
  const canMarkPaid =
    paymentStatus !== "paid" &&
    status !== "paid" &&
    status !== "completed" &&
    status !== "canceled" &&
    status !== "cancelled";

  async function handleMarkPaid() {
    setIsSaving(true);

    try {
      const response = await fetch(`/api/admin/orders/${orderId}/mark-paid`, {
        method: "POST",
      });

      if (!response.ok) {
        throw new Error("Failed to mark order as paid");
      }

      showToast("Заказ отмечен как оплаченный", "success");
      router.refresh();
    } catch {
      showToast("Не удалось отметить оплату", "error");
    } finally {
      setIsSaving(false);
    }
  }

  if (!canMarkPaid) {
    return null;
  }

  return (
    <Button
      className="mt-3 w-full bg-white text-burgundy ring-1 ring-coral-light hover:bg-coral-light"
      disabled={isSaving}
      onClick={handleMarkPaid}
      variant="ghost"
    >
      {isSaving ? "Сохраняем..." : "Отметить как оплаченный"}
    </Button>
  );
}
