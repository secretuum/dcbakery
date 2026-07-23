import { NextResponse } from "next/server";
import { markOverdueOrders } from "@/src/lib/orders/overdue";
import { sendMessage } from "@/src/lib/telegram/api";
import { logAction } from "@/src/lib/audit";
import { formatPrice } from "@/src/lib/format";

// Ежедневный крон консигнации: заявки confirmed_waiting_payment с прошедшим
// due_date → 'overdue' + уведомление в общий чат + журнал.
//
// Защита — секрет CRON_SECRET: заголовок `Authorization: Bearer <secret>` или
// `?secret=<secret>`. Блокировку клиентов НЕ трогаем — она динамическая
// (credit.ts + canPlaceOrder на оформлении заказа).

export const dynamic = "force-dynamic";

function authorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return false;

  const header = request.headers.get("authorization");
  if (header === `Bearer ${secret}`) return true;

  return new URL(request.url).searchParams.get("secret") === secret;
}

async function handle(request: Request) {
  if (!authorized(request)) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  const today = new Date().toISOString().slice(0, 10);

  let overdue;
  try {
    overdue = await markOverdueOrders(today);
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "overdue failed" },
      { status: 500 },
    );
  }

  if (overdue.length > 0) {
    const chatId =
      process.env.TELEGRAM_GROUP_CHAT_ID?.trim() || process.env.TELEGRAM_CHAT_ID?.trim();
    if (chatId) {
      const lines = overdue
        .map((o) => `• ${o.order_number} — ${formatPrice(o.total_amount)} (срок был до ${o.due_date})`)
        .join("\n");
      await sendMessage({
        chatId,
        text: `⏰ Просрочка оплаты (${overdue.length}):\n${lines}`,
      });
    }

    for (const o of overdue) {
      await logAction({
        source: "cron",
        action: "overdue",
        orderId: o.id,
        orderNumber: o.order_number,
        details: { due_date: o.due_date },
      });
    }
  }

  return NextResponse.json({ ok: true, marked: overdue.length });
}

export async function GET(request: Request) {
  return handle(request);
}

export async function POST(request: Request) {
  return handle(request);
}
