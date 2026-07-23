import "server-only";
import type { Order, OrderStatus } from "@/src/types";
import {
  cancelOrder,
  confirmAdminOrder,
  fetchAdminOrder,
  fetchAdminOrderItems,
  fetchClientById,
  insertPaymentEvent,
  markOrderPaid,
  updateAdminOrderStatus,
  updateOrderWhatsAppMessageId,
} from "@/src/lib/supabase/admin";
import { unmarkOrderPaid } from "@/src/lib/supabase/payment-audit";
import { saveInvoiceSnapshot } from "@/src/lib/supabase/invoice-snapshots";
import { createPaymentLink } from "@/src/lib/payments";
import {
  getWhatsAppChatIdFromPhone,
  replaceWhatsAppOrderMessage,
  sendCustomerOrderCanceledNotification,
  sendCustomerOrderConfirmationNotification,
  sendGreenApiTextMessage,
} from "@/src/lib/whatsapp";
import { fetchWhatsAppClientByChatId } from "@/src/lib/whatsapp-client-store";
import { canonicalOrderStatuses } from "@/src/lib/order-status";

// Единая логика действий над заказом (подтверждение / оплата / статусы / отмена).
// Раньше жила по одной копии в каждом admin-роуте; теперь и админка, и Telegram-бот
// зовут ЭТИ функции — одна правда на всех. Актор (кто действует) передаётся
// параметром: у веб-админа это email из cookie, у бота — Telegram-личность.
// Поведение 1-в-1 повторяет прежние роуты (см. app/api/admin/orders/**).

/** Кто выполняет действие — для журнала платёжных событий. */
export type OrderActor =
  | { kind: "admin"; email: string | null }
  | { kind: "telegram"; telegramId: number; role: string; name: string };

/** Ошибка-ожидаемая (валидация): роут отдаёт её как HTTP-статус, бот — как всплывашку. */
export type ActionError = { ok: false; status: number; error: string };

const allowedStatuses: readonly OrderStatus[] = canonicalOrderStatuses;

function addDays(isoDate: string, days: number): string {
  const d = new Date(isoDate);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

// WhatsApp клиенту пока спящий (пивот на Telegram + личный кабинет). Включается
// только явным WHATSAPP_ENABLED=true; по умолчанию — выключен.
function whatsappEnabled(): boolean {
  return process.env.WHATSAPP_ENABLED === "true";
}

// Общий «хвост» всех действий: перерисовать карточку заказа у менеджера в WhatsApp
// и сохранить новый message_id. Ошибки глотаем — это не должно ронять действие.
async function refreshManagerMessage(
  order: Order,
  previousMessageId: string | null | undefined,
): Promise<string | null> {
  const managerMessageId = await replaceWhatsAppOrderMessage(order, previousMessageId).catch(
    () => null,
  );
  if (managerMessageId) {
    await updateOrderWhatsAppMessageId(order.id, managerMessageId).catch(() => undefined);
  }
  return managerMessageId;
}

// Тело raw_payload для journal платёжных событий. Ветка admin повторяет прежний
// формат из роутов (admin_email + source: "admin"); ветка telegram фиксирует,
// кто из сотрудников нажал кнопку в общем чате.
function paymentRawPayload(
  action: string,
  actor: OrderActor,
  order: Order,
  extra?: Record<string, unknown>,
): Record<string, unknown> {
  if (actor.kind === "telegram") {
    return {
      action,
      order_number: order.order_number,
      source: "telegram",
      actor_telegram_id: actor.telegramId,
      actor_name: actor.name,
      actor_role: actor.role,
      ...extra,
    };
  }
  return {
    action,
    admin_email: actor.email,
    order_number: order.order_number,
    source: "admin",
    ...extra,
  };
}

// ————————————————————————————————————————————————————————————————
// Подтверждение заявки: счёт (payment link) + уведомление клиента + перевод в
// confirmed_waiting_payment + снимок счёта. Логика 1-в-1 из confirm/route.ts.
// ————————————————————————————————————————————————————————————————
export type ConfirmResult = {
  ok: true;
  order: Order | null;
  managerMessageId: string | null;
  paymentUrl: string;
  registrationRequested: boolean;
  whatsappMessageId: string | null;
};

export async function confirmOrder(
  id: string,
  opts: { origin: string; actor?: OrderActor },
): Promise<ConfirmResult | ActionError> {
  const order = await fetchAdminOrder(id);

  if (!order) {
    return { ok: false, status: 404, error: "Order not found" };
  }
  if (order.status === "confirmed_waiting_payment") {
    return { ok: false, status: 400, error: "Order already confirmed" };
  }
  if (order.status === "paid" || order.status === "completed" || order.status === "canceled") {
    return { ok: false, status: 400, error: "Order cannot be confirmed" };
  }

  const origin = opts.origin.replace(/\/$/, "");
  const client = order.client_id ? await fetchClientById(order.client_id) : null;
  const shipmentDate = order.delivery_date ?? new Date().toISOString().slice(0, 10);
  const now = new Date().toISOString();
  // Консигнация: срок оплаты отсчитывается от ПОДТВЕРЖДЕНИЯ (не от отгрузки).
  // Индивидуальный срок клиента в приоритете, иначе — CONSIGNMENT_DAYS (по умолчанию 4).
  const termDays = client?.payment_terms_days ?? Number(process.env.CONSIGNMENT_DAYS ?? 4);
  const dueDate = addDays(now.slice(0, 10), termDays);
  const paymentLink = createPaymentLink(order, undefined, origin);
  // Уведомление клиента в WhatsApp — только при включённом флаге (иначе клиент
  // берёт счёт в личном кабинете, а payment_status остаётся payment_link_created).
  const customerNotification = whatsappEnabled()
    ? await sendCustomerOrderConfirmationNotification(order, paymentLink.paymentUrl).catch(() => ({
        messageId: null,
        registrationRequested: false,
      }))
    : { messageId: null, registrationRequested: false };
  const whatsappMessageId = customerNotification.messageId;

  if (whatsappEnabled()) {
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
  }

  const confirmedOrder = await confirmAdminOrder(id, {
    confirmed_at: now,
    payment_id: paymentLink.paymentId,
    payment_link_sent_at: whatsappMessageId ? now : null,
    payment_provider: paymentLink.paymentProvider,
    payment_status: whatsappMessageId ? "payment_link_sent" : "payment_link_created",
    payment_url: paymentLink.paymentUrl,
    status: "confirmed_waiting_payment",
    ...(shipmentDate && { shipment_date: shipmentDate }),
    due_date: dueDate,
  });

  const managerMessageId = confirmedOrder
    ? await refreshManagerMessage(confirmedOrder, order.whatsapp_message_id)
    : null;

  // Снимок версии заказа, на которую выставлен счёт (ошибки не роняют подтверждение)
  if (confirmedOrder) {
    const items = await fetchAdminOrderItems(confirmedOrder.id).catch(() => []);
    await saveInvoiceSnapshot(confirmedOrder, items, now);
  }

  return {
    ok: true,
    order: confirmedOrder,
    managerMessageId,
    paymentUrl: paymentLink.paymentUrl,
    registrationRequested: customerNotification.registrationRequested,
    whatsappMessageId,
  };
}

// ————————————————————————————————————————————————————————————————
// Отметка «Оплачено» + журнал платёжного события. Логика из mark-paid/route.ts.
// ————————————————————————————————————————————————————————————————
export type MarkPaidResult = {
  ok: true;
  order: Order;
  managerMessageId: string | null;
  /** true, когда заказ уже был оплачен и мутации не потребовалось (идемпотентно). */
  noop: boolean;
};

export async function markPaid(
  id: string,
  opts: { actor: OrderActor },
): Promise<MarkPaidResult | ActionError> {
  const order = await fetchAdminOrder(id);

  if (!order) {
    return { ok: false, status: 404, error: "Order not found" };
  }
  if (order.status === "paid" || order.payment_status === "paid") {
    return { ok: true, order, managerMessageId: null, noop: true };
  }
  if (order.status === "canceled" || order.status === "completed") {
    return { ok: false, status: 400, error: "Order cannot be marked as paid" };
  }

  const paidOrder = await markOrderPaid(id);

  // null = атомарный guard отклонил UPDATE (payment_status уже стал 'paid' в
  // параллельном запросе) — идемпотентный успех
  if (!paidOrder) {
    return { ok: true, order, managerMessageId: null, noop: true };
  }

  await insertPaymentEvent({
    amount: Number(paidOrder.total_amount),
    event_id: `admin-mark-paid-${crypto.randomUUID()}`,
    order_id: paidOrder.id,
    payment_id: paidOrder.payment_id ?? null,
    provider: paidOrder.payment_provider ?? "manual",
    raw_payload: paymentRawPayload("mark_paid", opts.actor, paidOrder),
    status: "paid",
  });

  const managerMessageId = await refreshManagerMessage(paidOrder, order.whatsapp_message_id);
  return { ok: true, order: paidOrder, managerMessageId, noop: false };
}

// ————————————————————————————————————————————————————————————————
// Снятие ошибочной отметки оплаты. Логика из unmark-paid/route.ts.
// ————————————————————————————————————————————————————————————————
export type UnmarkPaidResult = { ok: true; order: Order; managerMessageId: string | null };

export async function unmarkPaid(
  id: string,
  opts: { actor: OrderActor },
): Promise<UnmarkPaidResult | ActionError> {
  const order = await fetchAdminOrder(id);

  if (!order) {
    return { ok: false, status: 404, error: "Order not found" };
  }
  if (order.payment_status !== "paid") {
    return { ok: false, status: 400, error: "Заказ не отмечен оплаченным" };
  }
  if (order.status !== "paid") {
    return {
      ok: false,
      status: 400,
      error: "Заказ уже в работе или завершён — сначала верните его статус, затем снимайте оплату",
    };
  }

  const updatedOrder = await unmarkOrderPaid(order);

  // null = кто-то успел изменить payment_status параллельно — состояние уже не 'paid'
  if (!updatedOrder) {
    const freshOrder = await fetchAdminOrder(id);
    return { ok: true, order: freshOrder ?? order, managerMessageId: null };
  }

  await insertPaymentEvent({
    amount: Number(order.total_amount),
    event_id: `admin-unmark-paid-${crypto.randomUUID()}`,
    order_id: order.id,
    payment_id: order.payment_id ?? null,
    provider: order.payment_provider ?? "manual",
    raw_payload: paymentRawPayload("unmark_paid", opts.actor, order, {
      previous_paid_at: order.paid_at ?? null,
    }),
    status: updatedOrder.payment_status ?? "unpaid",
  });

  const managerMessageId = await refreshManagerMessage(updatedOrder, order.whatsapp_message_id);
  return { ok: true, order: updatedOrder, managerMessageId };
}

// ————————————————————————————————————————————————————————————————
// Смена статуса (в работу / доставляется / выполнен и т.д.). Логика из
// status/route.ts: status === "paid" идёт через markOrderPaid (без journal —
// как в оригинале), остальное — updateAdminOrderStatus.
// ————————————————————————————————————————————————————————————————
export type ChangeStatusResult = { ok: true; order: Order | null; managerMessageId: string | null };

export async function changeStatus(
  id: string,
  status: string,
): Promise<ChangeStatusResult | ActionError> {
  if (!status || !allowedStatuses.includes(status as OrderStatus)) {
    return { ok: false, status: 400, error: "Invalid status" };
  }

  const previousOrder = await fetchAdminOrder(id);
  if (!previousOrder) {
    return { ok: false, status: 404, error: "Order not found" };
  }

  const order =
    status === "paid"
      ? await markOrderPaid(id)
      : await updateAdminOrderStatus(id, status as OrderStatus);
  const managerMessageId = order
    ? await refreshManagerMessage(order, previousOrder.whatsapp_message_id)
    : null;

  return { ok: true, order, managerMessageId };
}

// ————————————————————————————————————————————————————————————————
// Отмена заявки. Логика из cancel/route.ts.
// ————————————————————————————————————————————————————————————————
export type CancelResult = { ok: true; order: Order | null; managerMessageId: string | null };

export async function cancelOrderAction(
  id: string,
  opts?: { reason?: string | null; by?: "client" | "manager" },
): Promise<CancelResult | ActionError> {
  const order = await fetchAdminOrder(id);

  if (!order) {
    return { ok: false, status: 404, error: "Order not found" };
  }
  if (order.payment_status === "paid" || order.status === "paid") {
    return { ok: false, status: 400, error: "Paid order requires manual refund handling" };
  }
  if (order.status === "completed" || order.status === "canceled" || order.status === "cancelled") {
    return { ok: false, status: 400, error: "Order cannot be canceled" };
  }

  const canceledOrder = await cancelOrder(id, opts?.by ?? "manager", opts?.reason?.trim() || null);
  const managerMessageId = canceledOrder
    ? await refreshManagerMessage(canceledOrder, order.whatsapp_message_id)
    : null;

  if (canceledOrder && whatsappEnabled()) {
    await sendCustomerOrderCanceledNotification(canceledOrder).catch(() => null);
  }

  return { ok: true, order: canceledOrder, managerMessageId };
}
