import { Badge } from "@/src/components/ui/Badge";
import { paymentStatusLabels } from "@/src/lib/order-status";
import type { PaymentStatus } from "@/src/types";

const paymentStatusVariants: Record<PaymentStatus, "coral" | "burgundy" | "dark" | "neutral"> = {
  unpaid: "neutral",
  payment_link_created: "coral",
  payment_link_sent: "burgundy",
  partial: "coral",
  paid: "dark",
  failed: "coral",
  expired: "neutral",
  refunded: "neutral",
};

export function PaymentStatusBadge({ status }: { status?: PaymentStatus | null }) {
  if (!status) {
    return <Badge variant="neutral">не указано</Badge>;
  }

  return <Badge variant={paymentStatusVariants[status]}>{paymentStatusLabels[status]}</Badge>;
}
