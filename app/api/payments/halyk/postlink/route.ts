import { NextResponse } from "next/server";
import {
  checkHalykStatus,
  isHalykConfigured,
  isHalykPaidStatus,
  verifyHalykSecretHash,
} from "@/src/lib/providers/halyk";
import {
  findPaymentByInvoiceId,
  markPaymentAttemptPaid,
  updatePaymentAttempt,
} from "@/src/lib/supabase/payments-store";
import {
  fetchAdminOrder,
  insertPaymentEvent,
  updateOrderPaymentStatus,
  updateOrderWhatsAppMessageId,
} from "@/src/lib/supabase/admin";
import {
  replaceWhatsAppOrderMessage,
  sendCustomerPaymentStatusNotification,
} from "@/src/lib/whatsapp";

// postLink от Halyk ePay. Принципы:
// 1. Телу уведомления НЕ доверяем — оплату подтверждает только сервер-сервер
//    запрос check-status к Halyk.
// 2. Идемпотентность: попытка переводится в paid атомарно (guard в UPDATE),
//    повторный postLink получает 200 и ничего не меняет.
// 3. Всегда отвечаем 200 на корректно разобранные уведомления, чтобы банк
//    не ретраил бесконечно; 4xx — только на мусор.

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null ? (value as Record<string, unknown>) : {};
}

async function parseBody(request: Request): Promise<Record<string, unknown>> {
  const contentType = request.headers.get("content-type") ?? "";

  try {
    if (contentType.includes("application/json")) {
      return asRecord(await request.json());
    }

    const form = await request.formData();
    return Object.fromEntries(form.entries());
  } catch {
    return {};
  }
}

export async function POST(request: Request) {
  if (!isHalykConfigured()) {
    return NextResponse.json({ error: "Halyk is not configured" }, { status: 503 });
  }

  const body = await parseBody(request);
  const invoiceId = String(body.invoiceId ?? body.invoiceID ?? body.invoice_id ?? "").trim();

  if (!/^\d{6,15}$/.test(invoiceId)) {
    return NextResponse.json({ error: "invoiceId is missing" }, { status: 400 });
  }

  // secret_hash из уведомления сверяем с нашим детерминированным значением;
  // отсутствие поля не считаем фатальным — истину всё равно даёт check-status
  const providedHash = String(body.secret_hash ?? body.secretHash ?? "").trim();
  const hashOk = providedHash ? verifyHalykSecretHash(invoiceId, providedHash) : null;

  const payment = await findPaymentByInvoiceId(invoiceId);

  if (!payment) {
    return NextResponse.json({ error: "Unknown invoice" }, { status: 404 });
  }

  const order = await fetchAdminOrder(payment.order_id);

  if (!order) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }

  // Единственный источник истины — статус у самого банка
  let verified;
  try {
    verified = await checkHalykStatus(invoiceId);
  } catch (error) {
    console.error("[halyk] check-status failed:", error);
    // 500 → банк повторит уведомление позже; фоновая сверка тоже подберёт
    return NextResponse.json({ error: "Status check failed" }, { status: 500 });
  }

  await insertPaymentEvent({
    amount: verified.amount ?? null,
    event_id: `halyk-${invoiceId}-${verified.statusName}`,
    order_id: order.id,
    payment_id: String(payment.invoice_id),
    provider: "halyk",
    raw_payload: {
      hashOk,
      notification: body,
      source: "halyk_postlink",
      verified: verified.raw,
    },
    status: isHalykPaidStatus(verified.statusName) ? "paid" : "failed",
  });

  if (isHalykPaidStatus(verified.statusName)) {
    // Сверка суммы и валюты с попыткой
    const amountOk =
      verified.amount === undefined || Number(verified.amount) === Number(payment.amount);
    const currencyOk = !verified.currency || verified.currency.toUpperCase() === "KZT";

    if (!amountOk || !currencyOk) {
      await updatePaymentAttempt(payment.id, {
        failure_reason: `amount/currency mismatch: got ${verified.amount} ${verified.currency}`,
        status: "failed",
      });
      console.error("[halyk] amount/currency mismatch", { invoiceId });
      return NextResponse.json({ error: "Amount mismatch" }, { status: 200 });
    }

    // Атомарно: только первый вызов переведёт попытку в paid
    const paidAttempt = await markPaymentAttemptPaid(payment.id);

    if (!paidAttempt) {
      return NextResponse.json({ ok: true, alreadyProcessed: true });
    }

    if (verified.transactionId) {
      await updatePaymentAttempt(payment.id, { external_id: verified.transactionId }).catch(
        () => undefined,
      );
    }

    if (order.payment_status !== "paid" && order.status === "confirmed_waiting_payment") {
      const updatedOrder = await updateOrderPaymentStatus(order.id, "paid", "paid");
      const [managerMessageId] = await Promise.all([
        updatedOrder
          ? replaceWhatsAppOrderMessage(updatedOrder, order.whatsapp_message_id).catch(() => null)
          : null,
        updatedOrder
          ? sendCustomerPaymentStatusNotification(updatedOrder, "paid").catch(() => null)
          : null,
      ]);

      if (updatedOrder && managerMessageId) {
        await updateOrderWhatsAppMessageId(updatedOrder.id, managerMessageId).catch(() => undefined);
      }
    }

    return NextResponse.json({ ok: true });
  }

  // Неуспех: фиксируем на попытке; заказ остаётся «ждёт оплаты» — можно платить снова
  if (["FAILED", "REJECT", "3D", "CANCEL"].includes(verified.statusName)) {
    await updatePaymentAttempt(payment.id, {
      failure_reason: verified.statusName,
      status: verified.statusName === "CANCEL" ? "canceled" : "failed",
    });

    if (order.status === "confirmed_waiting_payment" && order.payment_status !== "paid") {
      await updateOrderPaymentStatus(order.id, "failed").catch(() => undefined);
    }
  }

  return NextResponse.json({ ok: true, status: verified.statusName });
}
