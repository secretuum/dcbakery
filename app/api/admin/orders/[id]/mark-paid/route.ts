import { NextResponse } from "next/server";
import {
  fetchAdminOrder,
  markOrderPaid,
  updateOrderWhatsAppMessageId,
} from "@/src/lib/supabase/admin";
import { replaceWhatsAppOrderMessage } from "@/src/lib/whatsapp";

type MarkPaidRouteProps = {
  params: Promise<{
    id: string;
  }>;
};

export async function POST(_request: Request, { params }: MarkPaidRouteProps) {
  const { id } = await params;
  const order = await fetchAdminOrder(id);

  if (!order) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }

  if (order.status === "paid" || order.payment_status === "paid") {
    return NextResponse.json({ order });
  }

  if (order.status === "canceled" || order.status === "completed") {
    return NextResponse.json({ error: "Order cannot be marked as paid" }, { status: 400 });
  }

  try {
    const paidOrder = await markOrderPaid(id);

    // null = atomic guard rejected the UPDATE (payment_status was already 'paid'
    // by a concurrent request between our fetch and this PATCH) — idempotent success
    if (!paidOrder) {
      return NextResponse.json({ order });
    }

    const managerMessageId = await replaceWhatsAppOrderMessage(
      paidOrder,
      order.whatsapp_message_id,
    ).catch(() => null);

    if (managerMessageId) {
      await updateOrderWhatsAppMessageId(paidOrder.id, managerMessageId).catch(() => undefined);
    }

    return NextResponse.json({ managerMessageId, order: paidOrder });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to mark order as paid" },
      { status: 500 },
    );
  }
}
