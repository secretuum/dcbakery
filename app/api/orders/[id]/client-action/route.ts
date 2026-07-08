import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import {
  acceptOrderRevision,
  cancelOrder,
  fetchAdminOrder,
  updateAdminOrderStatus,
  updateOrderCustomerDetails,
  updateOrderWhatsAppMessageId,
} from "@/src/lib/supabase/admin";
import {
  replaceWhatsAppOrderMessage,
  sendCustomerOrderCanceledNotification,
  sendGreenApiTextMessage,
  getWhatsAppChatIdFromPhone,
} from "@/src/lib/whatsapp";
import { CLIENT_SESSION_COOKIE, verifyClientSession } from "@/src/lib/client-session";

type ClientActionRouteProps = {
  params: Promise<{
    id: string;
  }>;
};

type ClientActionPayload = {
  action?: "accept_revision" | "cancel" | "request_change";
  comment?: string;
};

function appendComment(currentComment: string | null | undefined, nextComment: string) {
  return [currentComment, nextComment].filter(Boolean).join("\n");
}

async function notifyManager(orderId: string, previousMessageId?: string | null) {
  const order = await fetchAdminOrder(orderId);
  const managerMessageId = order
    ? await replaceWhatsAppOrderMessage(order, previousMessageId).catch(() => null)
    : null;

  if (order && managerMessageId) {
    await updateOrderWhatsAppMessageId(order.id, managerMessageId).catch(() => undefined);
  }

  return { managerMessageId, order };
}

export async function POST(request: Request, { params }: ClientActionRouteProps) {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get(CLIENT_SESSION_COOKIE)?.value;
  const session = sessionCookie ? await verifyClientSession(sessionCookie) : null;

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const payload = (await request.json().catch(() => ({}))) as ClientActionPayload;
  const order = await fetchAdminOrder(id);

  if (!order) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }

  const normalize = (p: string) => p.replace(/\D/g, "");

  if (!session.phone || normalize(session.phone) !== normalize(order.customer_phone ?? "")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (order.payment_status === "paid" || order.status === "paid") {
    return NextResponse.json({ error: "Paid order requires manual handling" }, { status: 400 });
  }

  if (order.status === "completed" || order.status === "canceled" || order.status === "cancelled") {
    return NextResponse.json({ error: "Order cannot be changed" }, { status: 400 });
  }

  try {
    if (payload.action === "cancel") {
      const canceledOrder = await cancelOrder(id, "client", payload.comment?.trim() || null);
      const result = canceledOrder
        ? await notifyManager(canceledOrder.id, order.whatsapp_message_id)
        : { managerMessageId: null, order: null };

      if (canceledOrder) {
        await sendCustomerOrderCanceledNotification(canceledOrder).catch(() => null);
      }

      return NextResponse.json({ ...result, order: canceledOrder });
    }

    if (payload.action === "accept_revision") {
      if (order.status !== "change_proposed") {
        return NextResponse.json({ error: "No revision is waiting for acceptance" }, { status: 400 });
      }

      const acceptedOrder = await acceptOrderRevision(id);
      const result = acceptedOrder
        ? await notifyManager(acceptedOrder.id, order.whatsapp_message_id)
        : { managerMessageId: null, order: null };
      const customerChatId = getWhatsAppChatIdFromPhone(order.customer_phone);

      if (customerChatId) {
        await sendGreenApiTextMessage(
          customerChatId,
          `Измененная заявка ${order.order_number} принята. Менеджер подтвердит заказ и отправит оплату.`,
        ).catch(() => null);
      }

      return NextResponse.json({ ...result, order: acceptedOrder });
    }

    if (payload.action === "request_change") {
      const comment = payload.comment?.trim();

      if (!comment) {
        return NextResponse.json({ error: "Comment is required" }, { status: 400 });
      }

      await updateOrderCustomerDetails(id, {
        comment: appendComment(order.comment, `Клиент просит изменить заявку: ${comment}`),
        revision_note: `Клиент просит изменить: ${comment}`,
      });
      const updatedOrder = await updateAdminOrderStatus(id, "pending_manager_confirmation");
      const result = updatedOrder
        ? await notifyManager(updatedOrder.id, order.whatsapp_message_id)
        : { managerMessageId: null, order: null };

      return NextResponse.json({ ...result, order: updatedOrder });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to process client action" },
      { status: 500 },
    );
  }
}
