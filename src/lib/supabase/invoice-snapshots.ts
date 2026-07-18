import "server-only";
import type { Order, OrderItem } from "@/src/types";

// Снапшот счёта (этап 1 платёжного аудита): при подтверждении заказа фиксируем
// позиции и сумму, на которые выставлен счёт. Отдельный модуль — запросы к БД
// намеренно не добавляются в admin.ts.

function getConfig() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    return null;
  }

  return { restUrl: `${supabaseUrl.replace(/\/$/, "")}/rest/v1`, serviceRoleKey };
}

/** Пишет снапшот; ошибки глотает — подтверждение заказа важнее журнала. */
export async function saveInvoiceSnapshot(order: Order, items: OrderItem[], confirmedAt: string) {
  const config = getConfig();

  if (!config) {
    return;
  }

  try {
    const response = await fetch(`${config.restUrl}/invoice_snapshots`, {
      method: "POST",
      headers: {
        apikey: config.serviceRoleKey,
        Authorization: `Bearer ${config.serviceRoleKey}`,
        "Content-Type": "application/json",
        Prefer: "return=minimal",
      },
      body: JSON.stringify({
        confirmed_at: confirmedAt,
        items: items.map((item) => ({
          product_id: item.product_id,
          product_name: item.product_name,
          qty: item.qty,
          unit: item.unit,
          price: item.price,
          total_amount: item.total_amount,
        })),
        order_id: order.id,
        order_number: order.order_number,
        total_amount: order.total_amount,
      }),
      cache: "no-store",
    });

    if (!response.ok) {
      console.error("[invoice-snapshots] insert failed:", response.status, await response.text());
    }
  } catch (error) {
    console.error("[invoice-snapshots] insert failed:", error);
  }
}
