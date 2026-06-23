import { NextResponse } from "next/server";
import { fetchProducts } from "@/src/lib/catalog";
import {
  fetchAdminOrder,
  replaceAdminOrderItems,
  updateOrderWhatsAppMessageId,
} from "@/src/lib/supabase/admin";
import {
  replaceWhatsAppOrderMessage,
  sendCustomerRevisionProposalNotification,
} from "@/src/lib/whatsapp";

type RevisionRouteProps = {
  params: Promise<{
    id: string;
  }>;
};

type RevisionPayload = {
  items?: Array<{
    productId?: string;
    qty?: number;
  }>;
  note?: string;
};

function getOrderUnit(product: Awaited<ReturnType<typeof fetchProducts>>[number]) {
  return product.unit === "кг" ? "кг" : "шт.";
}

export async function POST(request: Request, { params }: RevisionRouteProps) {
  const { id } = await params;
  const payload = (await request.json().catch(() => ({}))) as RevisionPayload;
  const order = await fetchAdminOrder(id);

  if (!order) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }

  if (order.payment_status === "paid" || order.status === "paid") {
    return NextResponse.json({ error: "Paid order requires manual handling" }, { status: 400 });
  }

  if (order.status === "completed" || order.status === "canceled" || order.status === "cancelled") {
    return NextResponse.json({ error: "Order cannot be revised" }, { status: 400 });
  }

  const products = await fetchProducts();
  const items = (payload.items ?? [])
    .map((item) => {
      const product = products.find((candidate) => candidate.id === item.productId);
      const qty = Number(item.qty);

      if (!product || !Number.isFinite(qty) || qty <= 0) {
        return null;
      }

      return {
        category: product.category?.name ?? null,
        price: product.price,
        product_id: product.id,
        product_name: product.name,
        qty,
        unit: getOrderUnit(product),
      };
    })
    .filter((item): item is NonNullable<typeof item> => Boolean(item));

  if (items.length === 0) {
    return NextResponse.json({ error: "Revision must contain at least one item" }, { status: 400 });
  }

  try {
    const result = await replaceAdminOrderItems({
      items,
      note: payload.note?.trim() || null,
      orderId: id,
    });
    const managerMessageId = result.order
      ? await replaceWhatsAppOrderMessage(result.order, order.whatsapp_message_id).catch(() => null)
      : null;

    if (result.order && managerMessageId) {
      await updateOrderWhatsAppMessageId(result.order.id, managerMessageId).catch(() => undefined);
    }

    if (result.order) {
      await sendCustomerRevisionProposalNotification(
        result.order,
        result.items,
        payload.note?.trim() || null,
      ).catch(() => null);
    }

    return NextResponse.json({ ...result, managerMessageId });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to propose order revision" },
      { status: 500 },
    );
  }
}
