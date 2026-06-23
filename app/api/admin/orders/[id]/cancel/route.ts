import { NextResponse } from "next/server";
import {
  cancelOrder,
  fetchAdminOrder,
  updateOrderWhatsAppMessageId,
} from "@/src/lib/supabase/admin";
import {
  replaceWhatsAppOrderMessage,
  sendCustomerOrderCanceledNotification,
} from "@/src/lib/whatsapp";

type CancelRouteProps = {
  params: Promise<{
    id: string;
  }>;
};

export async function POST(request: Request, { params }: CancelRouteProps) {
  const { id } = await params;
  const payload = (await request.json().catch(() => ({}))) as { reason?: string };
  const order = await fetchAdminOrder(id);

  if (!order) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }

  if (order.payment_status === "paid" || order.status === "paid") {
    return NextResponse.json({ error: "Paid order requires manual refund handling" }, { status: 400 });
  }

  if (order.status === "completed" || order.status === "canceled" || order.status === "cancelled") {
    return NextResponse.json({ error: "Order cannot be canceled" }, { status: 400 });
  }

  try {
    const canceledOrder = await cancelOrder(id, "manager", payload.reason?.trim() || null);
    const managerMessageId = canceledOrder
      ? await replaceWhatsAppOrderMessage(canceledOrder, order.whatsapp_message_id).catch(() => null)
      : null;

    if (canceledOrder && managerMessageId) {
      await updateOrderWhatsAppMessageId(canceledOrder.id, managerMessageId).catch(() => undefined);
    }

    if (canceledOrder) {
      await sendCustomerOrderCanceledNotification(canceledOrder).catch(() => null);
    }

    return NextResponse.json({ managerMessageId, order: canceledOrder });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to cancel order" },
      { status: 500 },
    );
  }
}
