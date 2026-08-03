import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { CLIENT_SESSION_COOKIE, verifyClientSession } from "@/src/lib/client-session";
import { fetchAdminOrder, fetchAdminOrderItems } from "@/src/lib/supabase/admin";
import { fetchProducts } from "@/src/lib/catalog";
import { orderMatchesSession } from "@/src/lib/orders/order-ownership";
import type { Product } from "@/src/types";

// Повтор заказа: по orderId (владелец = сессия) собираем текущие товары из каталога
// (актуальные цена/остаток), недоступные — пропускаем. Клиент добавляет их в корзину.

export async function POST(request: Request) {
  const sessionCookie = (await cookies()).get(CLIENT_SESSION_COOKIE)?.value;
  const session = sessionCookie ? await verifyClientSession(sessionCookie) : null;
  if (!session) {
    return NextResponse.json({ error: "Требуется вход в аккаунт" }, { status: 401 });
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const orderId = typeof (payload as { orderId?: unknown })?.orderId === "string"
    ? (payload as { orderId: string }).orderId
    : "";
  if (!orderId) {
    return NextResponse.json({ error: "orderId required" }, { status: 400 });
  }

  const order = await fetchAdminOrder(orderId);
  if (!order) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }

  // Владелец заказа: телефон ИЛИ email совпадает с сессией (логика в order-ownership, тесты там же).
  if (!orderMatchesSession(order, session)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const [items, products] = await Promise.all([fetchAdminOrderItems(orderId), fetchProducts()]);
  const byId = new Map(products.map((p) => [p.id, p]));
  const resolved: { product: Product; qty: number }[] = [];
  let skipped = 0;
  for (const item of items) {
    const product = byId.get(item.product_id);
    if (!product || product.stock_qty <= 0) {
      skipped += 1;
      continue;
    }
    resolved.push({ product, qty: item.qty });
  }

  return NextResponse.json({ items: resolved, skipped });
}
