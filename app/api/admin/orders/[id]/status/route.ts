import { NextResponse } from "next/server";
import {
  fetchAdminOrder,
  markOrderPaid,
  updateAdminOrderStatus,
  updateOrderWhatsAppMessageId,
} from "@/src/lib/supabase/admin";
import { canonicalOrderStatuses } from "@/src/lib/order-status";
import { replaceWhatsAppOrderMessage } from "@/src/lib/whatsapp";
import type { OrderStatus } from "@/src/types";

const allowedStatuses: readonly OrderStatus[] = canonicalOrderStatuses;

type StatusRouteProps = {
  params: Promise<{
    id: string;
  }>;
};

export async function PATCH(request: Request, { params }: StatusRouteProps) {
  const { id } = await params;
  const payload = (await request.json()) as { status?: string };

  if (!payload.status || !allowedStatuses.includes(payload.status as OrderStatus)) {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  }

  try {
    const previousOrder = await fetchAdminOrder(id);

    if (!previousOrder) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    const order =
      payload.status === "paid"
        ? await markOrderPaid(id)
        : await updateAdminOrderStatus(id, payload.status as OrderStatus);
    const managerMessageId = order
      ? await replaceWhatsAppOrderMessage(order, previousOrder.whatsapp_message_id).catch(() => null)
      : null;

    if (order && managerMessageId) {
      await updateOrderWhatsAppMessageId(order.id, managerMessageId).catch(() => undefined);
    }

    return NextResponse.json({ managerMessageId, order });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to update order" },
      { status: 500 },
    );
  }
}
