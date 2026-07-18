import { NextResponse } from "next/server";
import {
  confirmAdminOrder,
  fetchAdminOrder,
  fetchAdminOrderItems,
  fetchClientById,
  updateOrderWhatsAppMessageId,
} from "@/src/lib/supabase/admin";
import { saveInvoiceSnapshot } from "@/src/lib/supabase/invoice-snapshots";
import { createPaymentLink } from "@/src/lib/payments";
import {
  getWhatsAppChatIdFromPhone,
  replaceWhatsAppOrderMessage,
  sendCustomerOrderConfirmationNotification,
  sendGreenApiTextMessage,
} from "@/src/lib/whatsapp";
import { fetchWhatsAppClientByChatId } from "@/src/lib/whatsapp-client-store";

type ConfirmRouteProps = {
  params: Promise<{
    id: string;
  }>;
};

function addDays(isoDate: string, days: number): string {
  const d = new Date(isoDate);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

export async function POST(request: Request, { params }: ConfirmRouteProps) {
  const { id } = await params;
  const order = await fetchAdminOrder(id);

  if (!order) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }

  if (order.status === "confirmed_waiting_payment") {
    return NextResponse.json({ error: "Order already confirmed" }, { status: 400 });
  }

  if (order.status === "paid" || order.status === "completed" || order.status === "canceled") {
    return NextResponse.json({ error: "Order cannot be confirmed" }, { status: 400 });
  }

  try {
    const origin = (process.env.NEXT_PUBLIC_SITE_URL ?? new URL(request.url).origin).replace(/\/$/, "");
    const client = order.client_id ? await fetchClientById(order.client_id) : null;
    const shipmentDate = order.delivery_date ?? new Date().toISOString().slice(0, 10);
    const dueDate = client
      ? addDays(shipmentDate, client.payment_terms_days)
      : null;
    const paymentLink = createPaymentLink(order, undefined, origin);
    const customerNotification = await sendCustomerOrderConfirmationNotification(
      order,
      paymentLink.paymentUrl,
    ).catch(() => ({ messageId: null, registrationRequested: false }));
    const whatsappMessageId = customerNotification.messageId;

    const customerChatId = getWhatsAppChatIdFromPhone(order.customer_phone);
    if (customerChatId) {
      const clientProfile = await fetchWhatsAppClientByChatId(customerChatId).catch(() => null);
      if (clientProfile?.accountantPhone) {
        const accountantChatId = getWhatsAppChatIdFromPhone(clientProfile.accountantPhone);
        if (accountantChatId) {
          await sendGreenApiTextMessage(
            accountantChatId,
            `Счёт на оплату №${order.order_number} на сумму ${order.total_amount} ₸\n${origin}/documents/invoice/${order.id}`,
          ).catch(() => null);
        }
      }
    }
    const now = new Date().toISOString();
    const confirmedOrder = await confirmAdminOrder(id, {
      confirmed_at: now,
      payment_id: paymentLink.paymentId,
      payment_link_sent_at: whatsappMessageId ? now : null,
      payment_provider: paymentLink.paymentProvider,
      payment_status: whatsappMessageId ? "payment_link_sent" : "payment_link_created",
      payment_url: paymentLink.paymentUrl,
      status: "confirmed_waiting_payment",
      ...(shipmentDate && { shipment_date: shipmentDate }),
      ...(dueDate && { due_date: dueDate }),
    });
    const managerMessageId = confirmedOrder
      ? await replaceWhatsAppOrderMessage(confirmedOrder, order.whatsapp_message_id).catch(() => null)
      : null;

    if (confirmedOrder && managerMessageId) {
      await updateOrderWhatsAppMessageId(confirmedOrder.id, managerMessageId).catch(() => undefined);
    }

    // Фиксируем версию заказа, на которую выставлен счёт (ошибки не роняют подтверждение)
    if (confirmedOrder) {
      const items = await fetchAdminOrderItems(confirmedOrder.id).catch(() => []);
      await saveInvoiceSnapshot(confirmedOrder, items, now);
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
