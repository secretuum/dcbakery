import { NextResponse } from "next/server";
import { MIN_ORDER_AMOUNT } from "@/app/constants";
import { fetchProducts } from "@/src/lib/catalog";
import {
  getSupabaseAdminConfigError,
  insertOrderWithItems,
  updateOrderTelegramMessageId,
  updateOrderWhatsAppMessageId,
} from "@/src/lib/supabase/admin";
import { sendTelegramNotification } from "@/src/lib/telegram";
import { sendWhatsAppNotification } from "@/src/lib/whatsapp";
import type { Order } from "@/src/types";

type IncomingItem = {
  price?: number;
  product_id: string;
  product_name?: string;
  qty: number;
  total_amount?: number;
  unit?: string;
};

type IncomingOrderBody = {
  comment?: string;
  customer_bin?: string;
  company_name?: string;
  customer_email?: string;
  customer_name?: string;
  customer_phone?: string;
  delivery_address?: string;
  delivery_date?: string;
  delivery_time?: string;
  items?: IncomingItem[];
  payment_method?: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function asString(value: unknown) {
  if (typeof value !== "string") {
    return "";
  }

  const trimmedValue = value.trim();
  const normalizedValue = trimmedValue.toLowerCase();

  return normalizedValue === "null" || normalizedValue === "undefined" ? "" : trimmedValue;
}

function asPositiveNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : 0;
}

function getTomorrowDate() {
  const date = new Date();
  date.setDate(date.getDate() + 1);
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
  return date.toISOString().slice(0, 10);
}

function generateOrderNumber() {
  const year = new Date().getFullYear();
  const suffix = Date.now().toString().slice(-6);
  return `DCB-${year}-${suffix}`;
}

function parseItems(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter(isRecord)
    .map((item): IncomingItem => {
      const qty = asPositiveNumber(item.qty);

      return {
        product_id: asString(item.product_id),
        qty,
      };
    })
    .filter((item) => item.product_id && item.qty > 0);
}

function parseBody(value: unknown): IncomingOrderBody {
  if (!isRecord(value)) {
    return {};
  }

  return {
    comment: asString(value.comment),
    company_name: asString(value.company_name),
    customer_bin: asString(value.customer_bin),
    customer_email: asString(value.customer_email),
    customer_name: asString(value.customer_name),
    customer_phone: asString(value.customer_phone),
    delivery_address: asString(value.delivery_address),
    delivery_date: asString(value.delivery_date),
    delivery_time: asString(value.delivery_time),
    items: parseItems(value.items),
    payment_method: asString(value.payment_method),
  };
}

function validateOrder(body: IncomingOrderBody) {
  const errors: string[] = [];
  const phoneDigits = body.customer_phone?.replace(/\D/g, "") ?? "";
  const items = body.items ?? [];
  const totalAmount = items.reduce((sum, item) => sum + (item.price ?? 0) * item.qty, 0);

  if (!body.company_name) {
    errors.push("company_name is required");
  }

  if (!body.customer_name) {
    errors.push("customer_name is required");
  }

  if (phoneDigits.length < 11) {
    errors.push("customer_phone is invalid");
  }

  if (!body.delivery_date) {
    errors.push("delivery_date is required");
  } else if (body.delivery_date < getTomorrowDate()) {
    errors.push("delivery_date must be tomorrow or later");
  }

  if (items.length === 0) {
    errors.push("items are required");
  }

  if (totalAmount < MIN_ORDER_AMOUNT) {
    errors.push("minimum order amount is not reached");
  }

  return { errors, totalAmount };
}

async function resolveItemsFromServer(items: IncomingItem[]) {
  const products = await fetchProducts();
  const productMap = new Map(products.map((product) => [product.id, product]));
  const errors: string[] = [];
  const resolvedItems = items.flatMap((item): IncomingItem[] => {
    const product = productMap.get(item.product_id);

    if (!product) {
      errors.push(`unknown product: ${item.product_id}`);
      return [];
    }

    return [
      {
        product_id: product.id,
        qty: item.qty,
      },
    ];
  });

  return { errors, productMap, resolvedItems };
}

export async function POST(request: Request) {
  const supabaseConfigError = getSupabaseAdminConfigError();

  if (supabaseConfigError) {
    return NextResponse.json({ error: supabaseConfigError }, { status: 503 });
  }

  let payload: unknown;

  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsedBody = parseBody(payload);
  const { errors: itemErrors, productMap, resolvedItems } = await resolveItemsFromServer(
    parsedBody.items ?? [],
  );
  const body = {
    ...parsedBody,
    items: resolvedItems.map((item) => {
      const product = productMap.get(item.product_id);

      return {
        product_id: item.product_id,
        qty: item.qty,
        price: product?.price ?? 0,
        product_name: product?.name ?? item.product_id,
        total_amount: (product?.price ?? 0) * item.qty,
        unit: product?.unit ?? "шт",
      };
    }),
  };
  const { errors, totalAmount } = validateOrder(body);
  errors.push(...itemErrors);

  if (errors.length > 0) {
    return NextResponse.json({ errors }, { status: 400 });
  }

  const orderId = crypto.randomUUID();
  const orderNumber = generateOrderNumber();
  const orderItems = (body.items ?? []).map((item) => ({
    id: crypto.randomUUID(),
    order_id: orderId,
    product_id: item.product_id,
    product_name: item.product_name ?? item.product_id,
    unit: item.unit ?? "шт",
    qty: item.qty,
    price: item.price ?? 0,
    total_amount: item.total_amount ?? (item.price ?? 0) * item.qty,
  }));
  const order: Order = {
    id: orderId,
    order_number: orderNumber,
    source: "website",
    company_name: body.company_name ?? "",
    customer_bin: body.customer_bin || null,
    customer_name: body.customer_name ?? "",
    customer_phone: body.customer_phone ?? "",
    customer_email: body.customer_email || null,
    delivery_address: body.delivery_address || null,
    delivery_date: body.delivery_date || null,
    delivery_time: body.delivery_time || null,
    payment_method: body.payment_method || null,
    comment: body.comment || null,
    status: "pending_manager_confirmation",
    total_amount: totalAmount,
    payment_status: "unpaid",
    created_at: new Date().toISOString(),
  };

  try {
    await insertOrderWithItems(order, orderItems);
  } catch {
    return NextResponse.json(
      {
        error: "Failed to save order",
      },
      { status: 500 },
    );
  }

  const [whatsappMessageId, telegramMessageId] = await Promise.all([
    sendWhatsAppNotification(order, orderItems).catch(() => null),
    sendTelegramNotification(order, orderItems)
      .then((messageId) => (messageId ? String(messageId) : null))
      .catch(() => null),
  ]);

  await Promise.all([
    whatsappMessageId
      ? updateOrderWhatsAppMessageId(orderId, whatsappMessageId).catch(() => undefined)
      : Promise.resolve(),
    telegramMessageId
      ? updateOrderTelegramMessageId(orderId, telegramMessageId).catch(() => undefined)
      : Promise.resolve(),
  ]);

  return NextResponse.json({
    orderId,
    orderNumber,
    whatsappMessageId,
    telegramMessageId,
  });
}
