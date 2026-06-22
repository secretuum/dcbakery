import { Badge } from "@/src/components/ui/Badge";
import { orderStatusLabels, orderStatusVariants } from "@/src/lib/order-status";
import type { OrderStatus } from "@/src/types";

export function OrderStatusBadge({ status }: { status: OrderStatus }) {
  return <Badge variant={orderStatusVariants[status]}>{orderStatusLabels[status]}</Badge>;
}

export { orderStatusLabels as statusLabels };
