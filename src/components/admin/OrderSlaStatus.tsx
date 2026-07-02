"use client";

import { useEffect, useState } from "react";
import { Badge } from "@/src/components/ui/Badge";
import { orderStatusLabels, orderStatusVariants } from "@/src/lib/order-status";
import type { OrderStatus } from "@/src/types";

const SLA_DURATION_MS = 30 * 60 * 1000;

type OrderSlaStatusProps = {
  createdAt: string;
  status: OrderStatus;
};

function formatRemainingTime(milliseconds: number) {
  const totalSeconds = Math.max(0, Math.ceil(milliseconds / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function isUnprocessedStatus(status: OrderStatus) {
  return status === "pending_manager_confirmation" || status === "new";
}

export function OrderSlaStatus({ createdAt, status }: OrderSlaStatusProps) {
  const [now, setNow] = useState<number | null>(null);
  const isUnprocessed = isUnprocessedStatus(status);

  useEffect(() => {
    if (!isUnprocessed) {
      return;
    }

    const timeoutId = window.setTimeout(() => setNow(Date.now()), 0);
    const intervalId = window.setInterval(() => setNow(Date.now()), 1000);

    return () => {
      window.clearTimeout(timeoutId);
      window.clearInterval(intervalId);
    };
  }, [isUnprocessed]);

  if (!isUnprocessed) {
    return <Badge variant={orderStatusVariants[status]}>{orderStatusLabels[status]}</Badge>;
  }

  const deadline = new Date(createdAt).getTime() + SLA_DURATION_MS;
  const remaining = now === null ? SLA_DURATION_MS : deadline - now;
  const isOverdue = remaining <= 0;

  if (isOverdue) {
    return (
      <span
        className="sla-flame inline-flex min-h-11 min-w-28 flex-col items-center justify-center bg-raspberry px-4 pb-2 pt-3 text-center text-white"
        title="Заявка не обработана более 30 минут"
      >
        <span className="text-xs font-black uppercase">Срочно</span>
        <span className="mt-1 text-xs font-bold">более 30 мин.</span>
      </span>
    );
  }

  return (
    <span className="inline-flex flex-col items-start gap-1">
      <Badge variant="coral">{orderStatusLabels[status]}</Badge>
      <span className="text-xs font-black tabular-nums text-burgundy">
        Осталось {formatRemainingTime(remaining)}
      </span>
    </span>
  );
}
