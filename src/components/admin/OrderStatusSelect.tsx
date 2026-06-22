"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useToast } from "@/src/contexts/ToastContext";
import {
  canonicalOrderStatuses,
  isCanonicalOrderStatus,
  orderStatusLabels,
} from "@/src/lib/order-status";
import type { OrderStatus } from "@/src/types";

const statusOptions = canonicalOrderStatuses.map((status) => ({
  label: orderStatusLabels[status],
  value: status,
}));

type OrderStatusSelectProps = {
  orderId: string;
  status: OrderStatus;
};

export function OrderStatusSelect({ orderId, status }: OrderStatusSelectProps) {
  const router = useRouter();
  const { showToast } = useToast();
  const [currentStatus, setCurrentStatus] = useState<OrderStatus>(status);
  const [isSaving, setIsSaving] = useState(false);

  async function handleChange(nextStatus: OrderStatus) {
    setCurrentStatus(nextStatus);
    setIsSaving(true);

    try {
      const response = await fetch(`/api/admin/orders/${orderId}/status`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ status: nextStatus }),
      });

      if (!response.ok) {
        throw new Error("Failed to update status");
      }

      showToast("Статус обновлен", "success");
      router.refresh();
    } catch {
      setCurrentStatus(status);
      showToast("Не удалось обновить статус", "error");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <label className="block">
      <span className="text-xs font-black uppercase text-muted">Статус</span>
      <select
        className="mt-2 min-h-12 w-full rounded-xl border border-black/10 bg-white px-4 py-3 text-sm font-black text-dark outline-none transition focus:border-coral focus:ring-2 focus:ring-coral/25"
        value={currentStatus}
        disabled={isSaving}
        onChange={(event) => handleChange(event.currentTarget.value as OrderStatus)}
      >
        {!isCanonicalOrderStatus(status) ? (
          <option value={status}>{orderStatusLabels[status]}</option>
        ) : null}
        {statusOptions.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}
