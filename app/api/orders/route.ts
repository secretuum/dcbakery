import { NextResponse } from "next/server";
import { B2B_PAYMENT_METHODS, MIN_ORDER_AMOUNT } from "@/app/constants";
import { fetchProducts } from "@/src/lib/catalog";
import {
  fetchClientByEmail,
  fetchClientByPhone,
  getSupabaseAdminConfigError,
  insertOrderWithItems,
  updateOrderTelegramMessageId,
  updateOrderWhatsAppMessageId,
} from "@/src/lib/supabase/admin";
import { canPlaceOrder } from "@/src/lib/credit";
import { sendTelegramNotification } from "@/src/lib/telegram";
import {
  getWhatsAppChatIdFromPhone,
  sendWhatsAppNotification,
} from "@/src/lib/whatsapp";
import {
  mergeClientAddressList,
  saveWhatsAppClientProfile,
} from "@/src/lib/whatsapp-client-store";
import { checkRateLimit, getRequestIdentifier } from "@/src/lib/rate-limit";
import type { Order } from "@/src/types";

const OFERTA_VERSION = "2026-07-14";

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
  request_avr?: boolean;
  oferta_accepted?: boolean;
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
    request_avr: value.request_avr === true,
    oferta_accepted: value.oferta_accepted === true,
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

  if (
    !body.payment_method ||
    !B2B_PAYMENT_METHODS.includes(
      body.payment_method as (typeof B2B_PAYMENT_METHODS)[number],
    )
  ) {
    errors.push("payment_method is invalid");
  }

  if (totalAmount < MIN_ORDER_AMOUNT) {
    errors.push("minimum order amount is not reached");
  }

  if (!body.oferta_accepted) {
    errors.push("oferta must be accepted");
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

    if (product.stock_qty <= 0) {
      errors.push(`product is out of stock: ${product.name}`);
      return [];
    }

    if (!Number.isInteger(item.qty)) {
      errors.push(`quantity must be a whole number: ${product.name}`);
      return [];
    }

    if (item.qty > product.stock_qty) {
      errors.push(`requested quantity exceeds stock: ${product.name}`);
      return [];
    }

    if (item.qty < product.min_qty) {
      errors.push(`requested quantity is below minimum: ${product.name}`);
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
  const rateLimit = checkRateLimit({
    identifier: getRequestIdentifier(request),
    limit: 10,
    namespace: "orders:create",
    windowMs: 10 * 60 * 1000,
  });

  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: "Too many order attempts" },
      {
        status: 429,
        headers: { "Retry-After": String(rateLimit.retryAfterSeconds) },
      },
    );
  }

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

  const normalizedPhone = body.customer_phone?.replace(/\D/g, "")
    ? `+${body.customer_phone.replace(/\D/g, "")}`
    : null;
  const client = normalizedPhone
    ? await fetchClientByPhone(normalizedPhone)
    : body.customer_email
      ? await fetchClientByEmail(body.customer_email)
      : null;

  if (client) {
    const creditCheck = await canPlaceOrder(client, totalAmount);
    if (!creditCheck.allowed) {
      return NextResponse.json(
        { errors: [creditCheck.reason ?? "Заказ не может быть принят"] },
        { status: 409 },
      );
    }
  }

  const orderId = crypto.randomUUID();
  const orderNumber = generateOrderNumber();
  const orderItems = (body.items ?? []).map((item) => ({
    id: crypto.randomUUID(),
    category: productMap.get(item.product_id)?.category?.name ?? null,
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
    request_avr: body.request_avr === true,
    comment: body.comment || null,
    client_id: client?.id ?? null,
    status: "pending_manager_confirmation",
    total_amount: totalAmount,
    payment_status: "unpaid",
    oferta_accepted_at: new Date().toISOString(),
    oferta_version: OFERTA_VERSION,
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

  const customerChatId = getWhatsAppChatIdFromPhone(order.customer_phone);

  if (customerChatId) {
    await saveWhatsAppClientProfile({
      chatId: customerChatId,
      companyName: order.company_name,
      customerBin: order.customer_bin,
      customerEmail: order.customer_email,
      customerName: order.customer_name,
      customerPhone: order.customer_phone,
      deliveryAddress: order.delivery_address,
      deliveryDate: order.delivery_date,
      deliveryTime: order.delivery_time,
      paymentMethod: order.payment_method,
      addresses: mergeClientAddressList([], order.delivery_address),
      lastOrderId: order.id,
    }).catch((error) => {
      console.warn("[orders] Failed to save customer profile:", error);
    });
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
