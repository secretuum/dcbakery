import { NextResponse } from "next/server";
import {
  checkHalykStatus,
  isHalykConfigured,
  isHalykPaidStatus,
} from "@/src/lib/providers/halyk";
import {
  listUnsettledPayments,
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

// Сверка незавершённых попыток Halyk: ловит случай «клиент оплатил, postLink
// не дошёл». Запускать Render Cron'ом раз в 10 минут:
//   GET /api/payments/halyk/reconcile?secret=$PAYMENTS_RECONCILE_SECRET
// Просроченные попытки без оплаты помечаются expired.

export const dynamic = "force-dynamic";

function isAuthorized(request: Request) {
  const secret = process.env.PAYMENTS_RECONCILE_SECRET?.trim();

  if (!secret) {
    return false;
  }

  const url = new URL(request.url);
  const provided = (
    request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ??
    url.searchParams.get("secret") ??
    ""
  ).trim();

  return provided === secret;
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!isHalykConfigured()) {
    return NextResponse.json({ ok: true, skipped: "halyk not configured" });
  }

  const attempts = await listUnsettledPayments(5, 50);
  const results: Array<{ invoiceId: number; outcome: string }> = [];

  for (const attempt of attempts) {
    try {
      const verified = await checkHalykStatus(attempt.invoice_id);

      if (isHalykPaidStatus(verified.statusName)) {
        const paidAttempt = await markPaymentAttemptPaid(attempt.id);

        if (paidAttempt) {
          await insertPaymentEvent({
            amount: verified.amount ?? Number(attempt.amount),
            event_id: `halyk-reconcile-${attempt.invoice_id}-paid`,
            order_id: attempt.order_id,
            payment_id: String(attempt.invoice_id),
            provider: "halyk",
            raw_payload: { source: "halyk_reconcile", verified: verified.raw },
            status: "paid",
          });

          const order = await fetchAdminOrder(attempt.order_id);

          if (
            order &&
            order.payment_status !== "paid" &&
            order.status === "confirmed_waiting_payment"
          ) {
            const updatedOrder = await updateOrderPaymentStatus(order.id, "paid", "paid");
            const [managerMessageId] = await Promise.all([
              updatedOrder
                ? replaceWhatsAppOrderMessage(updatedOrder, order.whatsapp_message_id).catch(
                    () => null,
                  )
                : null,
              updatedOrder
                ? sendCustomerPaymentStatusNotification(updatedOrder, "paid").catch(() => null)
                : null,
            ]);

            if (updatedOrder && managerMessageId) {
              await updateOrderWhatsAppMessageId(updatedOrder.id, managerMessageId).catch(
                () => undefined,
              );
            }
          }
        }

        results.push({ invoiceId: attempt.invoice_id, outcome: "paid" });
        continue;
      }

      if (["FAILED", "REJECT", "3D"].includes(verified.statusName)) {
        await updatePaymentAttempt(attempt.id, {
          failure_reason: verified.statusName,
          status: "failed",
        });
        results.push({ invoiceId: attempt.invoice_id, outcome: "failed" });
        continue;
      }

      // NOT_FOUND/пусто: клиент не дошёл до оплаты. Просрочилась — гасим.
      if (attempt.expires_at && new Date(attempt.expires_at).getTime() < Date.now()) {
        await updatePaymentAttempt(attempt.id, { status: "expired" });
        results.push({ invoiceId: attempt.invoice_id, outcome: "expired" });
      } else {
        results.push({ invoiceId: attempt.invoice_id, outcome: verified.statusName || "pending" });
      }
    } catch (error) {
      console.error("[halyk] reconcile failed for", attempt.invoice_id, error);
      results.push({ invoiceId: attempt.invoice_id, outcome: "error" });
    }
  }

  return NextResponse.json({ ok: true, checked: attempts.length, results });
}
