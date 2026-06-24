import { NextResponse } from "next/server";
import {
  confirmAdminOrder,
  fetchAdminOrder,
  updateOrderWhatsAppMessageId,
} from "@/src/lib/supabase/admin";
import { createPaymentLink } from "@/src/lib/payments";
import {
  replaceWhatsAppOrderMessage,
  sendCustomerOrderConfirmationNotification,
} from "@/src/lib/whatsapp";

type ConfirmRouteProps = {
  params: Promise<{
    id: string;
  }>;
};

export async function POST(request: Request, { params }: ConfirmRouteProps) {
  const { id } = await params;
  const order = await fetchAdminOrder(id);

  if (!order) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }

  if (order.status === "paid" || order.status === "completed" || order.status === "canceled") {
    return NextResponse.json({ error: "Order cannot be confirmed" }, { status: 400 });
  }

  try {
    const origin = new URL(request.url).origin;
    const paymentLink = createPaymentLink(order, undefined, origin);
    const customerNotification = await sendCustomerOrderConfirmationNotification(
      order,
      paymentLink.paymentUrl,
    ).catch(() => ({ messageId: null, registrationRequested: false }));
    const whatsappMessageId = customerNotification.messageId;
    const now = new Date().toISOString();
    const confirmedOrder = await confirmAdminOrder(id, {
      confirmed_at: now,
      payment_id: paymentLink.paymentId,
      payment_link_sent_at: whatsappMessageId ? now : null,
      payment_provider: paymentLink.paymentProvider,
      payment_status: whatsappMessageId ? "payment_link_sent" : "payment_link_created",
      payment_url: paymentLink.paymentUrl,
      status: "confirmed_waiting_payment",
    });
    const managerMessageId = confirmedOrder
      ? await replaceWhatsAppOrderMessage(confirmedOrder, order.whatsapp_message_id).catch(() => null)
      : null;

    if (confirmedOrder && managerMessageId) {
      await updateOrderWhatsAppMessageId(confirmedOrder.id, managerMessageId).catch(() => undefined);
    }

    return NextResponse.json({
      order: confirmedOrder,
      managerMessageId,
      paymentUrl: paymentLink.paymentUrl,
      registrationRequested: customerNotification.registrationRequested,
      whatsappMessageId,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to confirm order" },
      { status: 500 },
    );
  }
}
