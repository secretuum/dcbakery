import { NextResponse } from "next/server";
import {
  fetchAdminOrder,
  insertPaymentEvent,
  updateOrderWhatsAppMessageId,
} from "@/src/lib/supabase/admin";
import { getAdminEmail } from "@/src/lib/admin-identity";
import { unmarkOrderPaid } from "@/src/lib/supabase/payment-audit";
import { replaceWhatsAppOrderMessage } from "@/src/lib/whatsapp";

// Снятие ошибочной отметки оплаты (этап 0 платёжного аудита).
// Разрешено только пока заказ не ушёл дальше по жизненному циклу:
// статус ровно 'paid'. Для delivering/completed — сначала вернуть статус, осознанно.

type UnmarkPaidRouteProps = {
  params: Promise<{
    id: string;
  }>;
};

export async function POST(_request: Request, { params }: UnmarkPaidRouteProps) {
  const { id } = await params;
  const order = await fetchAdminOrder(id);

  if (!order) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }

  if (order.payment_status !== "paid") {
    return NextResponse.json({ error: "Заказ не отмечен оплаченным" }, { status: 400 });
  }

  if (order.status !== "paid") {
    return NextResponse.json(
      { error: "Заказ уже в работе или завершён — сначала верните его статус, затем снимайте оплату" },
      { status: 400 },
    );
  }

  try {
    const updatedOrder = await unmarkOrderPaid(order);

    // null = кто-то успел изменить payment_status параллельно — состояние уже не 'paid'
    if (!updatedOrder) {
      const freshOrder = await fetchAdminOrder(id);
      return NextResponse.json({ order: freshOrder ?? order });
    }

    const adminEmail = await getAdminEmail();
    await insertPaymentEvent({
      amount: Number(order.total_amount),
      event_id: `admin-unmark-paid-${crypto.randomUUID()}`,
      order_id: order.id,
      payment_id: order.payment_id ?? null,
      provider: order.payment_provider ?? "manual",
      raw_payload: {
        action: "unmark_paid",
        admin_email: adminEmail,
        order_number: order.order_number,
        previous_paid_at: order.paid_at ?? null,
        source: "admin",
      },
      status: updatedOrder.payment_status ?? "unpaid",
    });

    const managerMessageId = await replaceWhatsAppOrderMessage(
      updatedOrder,
      order.whatsapp_message_id,
    ).catch(() => null);

    if (managerMessageId) {
      await updateOrderWhatsAppMessageId(updatedOrder.id, managerMessageId).catch(() => undefined);
    }

    return NextResponse.json({ managerMessageId, order: updatedOrder });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to unmark payment" },
      { status: 500 },
    );
  }
}
