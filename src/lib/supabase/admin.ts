import "server-only";
import type {
  ClientOrderSummary,
  Order,
  OrderItem,
  OrderStatus,
  PaymentProvider,
  PaymentStatus,
  ProductStopEvent,
} from "@/src/types";

type SupabaseOrderPayload = Omit<Order, "updated_at"> & {
  telegram_message_id?: string | null;
};

type SupabaseOrderItemPayload = Omit<OrderItem, "created_at">;

type SupabaseRestError = {
  code?: string;
  details?: string;
  hint?: string;
  message?: string;
};

type OrderConfirmationPatch = {
  confirmed_at: string;
  payment_id: string;
  payment_link_sent_at?: string | null;
  payment_provider: string;
  payment_status: string;
  payment_url: string;
  status: OrderStatus;
};

type PaymentEventPayload = {
  amount?: number | null;
  event_id?: string | null;
  order_id?: string | null;
  payment_id?: string | null;
  provider?: PaymentProvider | null;
  raw_payload: unknown;
  status?: PaymentStatus | null;
};

export type AppSetting = {
  key: string;
  updated_at?: string | null;
  value: string | null;
};

export type CatalogProductOverride = {
  category_slug?: string | null;
  composition?: string | null;
  composition_kz?: string | null;
  description?: string | null;
  image?: string | null;
  is_active?: boolean | null;
  is_archived?: boolean | null;
  is_halal?: boolean | null;
  is_new?: boolean | null;
  is_popular?: boolean | null;
  is_promo?: boolean | null;
  min_qty?: number | string | null;
  name?: string | null;
  package_type?: string | null;
  price?: number | string | null;
  product_id: string;
  shelf_life?: string | null;
  slug?: string | null;
  step_qty?: number | string | null;
  stock_qty?: number | string | null;
  storage?: string | null;
  subcategory?: string | null;
  unit?: string | null;
  updated_at?: string | null;
  weight_grams?: number | string | null;
  weight_label?: string | null;
};

type OrderCancellationActor = "client" | "manager";

type OrderRevisionItemInput = {
  category?: string | null;
  price: number;
  product_id: string;
  product_name: string;
  qty: number;
  unit: string;
};

type OrderCustomerDetailsPatch = {
  company_name?: string | null;
  customer_bin?: string | null;
  customer_name?: string | null;
  customer_email?: string | null;
  delivery_address?: string | null;
  delivery_date?: string | null;
  delivery_time?: string | null;
  payment_method?: string | null;
  comment?: string | null;
  revision_note?: string | null;
};

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

function getSupabaseRestUrl(table: string) {
  if (!supabaseUrl) {
    return null;
  }

  return `${supabaseUrl.replace(/\/$/, "")}/rest/v1/${table}`;
}

export function getSupabaseAdminConfigError() {
  if (!supabaseUrl) {
    return "NEXT_PUBLIC_SUPABASE_URL is not configured";
  }

  if (!serviceRoleKey) {
    return "SUPABASE_SERVICE_ROLE_KEY is not configured";
  }

  return null;
}

async function parseSupabaseError(response: Response) {
  try {
    const error = (await response.json()) as SupabaseRestError;
    return error.message ?? response.statusText;
  } catch {
    return response.statusText;
  }
}

async function supabaseRequest<T>(table: string, body: unknown) {
  const url = getSupabaseRestUrl(table);

  if (!url || !serviceRoleKey) {
    throw new Error(getSupabaseAdminConfigError() ?? "Supabase is not configured");
  }

  const response = await fetch(url, {
    method: "POST",
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    throw new Error(await parseSupabaseError(response));
  }

  return (await response.json()) as T;
}

async function supabaseUpsert<T>(table: string, body: unknown, onConflict: string) {
  const url = getSupabaseRestUrl(table);

  if (!url || !serviceRoleKey) {
    throw new Error(getSupabaseAdminConfigError() ?? "Supabase is not configured");
  }

  const response = await fetch(`${url}?on_conflict=${encodeURIComponent(onConflict)}`, {
    method: "POST",
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
      "Content-Type": "application/json",
      Prefer: "resolution=merge-duplicates,return=representation",
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    throw new Error(await parseSupabaseError(response));
  }

  return (await response.json()) as T;
}

function isPaymentFlowMigrationMissing(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);

  return (
    message.includes("schema cache") ||
    message.includes("orders_status_check") ||
    message.includes("Could not find") ||
    message.includes("payment_status") ||
    message.includes("source")
  );
}

function isOrderDocumentsMigrationMissing(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);

  return message.includes("request_avr");
}

function isCatalogOverridesMigrationMissing(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);

  return message.includes("catalog_product_overrides") || message.includes("Could not find");
}

function isAppSettingsMigrationMissing(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);

  return message.includes("app_settings") || message.includes("Could not find");
}

function isStopEventsMigrationMissing(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);

  return message.includes("product_stop_events") || message.includes("Could not find");
}

async function supabaseGet<T>(table: string, query: string) {
  const url = getSupabaseRestUrl(table);

  if (!url || !serviceRoleKey) {
    throw new Error(getSupabaseAdminConfigError() ?? "Supabase is not configured");
  }

  const response = await fetch(`${url}?${query}`, {
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
    },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(await parseSupabaseError(response));
  }

  return (await response.json()) as T;
}

async function supabasePatch<T>(table: string, query: string, body: unknown) {
  const url = getSupabaseRestUrl(table);

  if (!url || !serviceRoleKey) {
    throw new Error(getSupabaseAdminConfigError() ?? "Supabase is not configured");
  }

  const response = await fetch(`${url}?${query}`, {
    method: "PATCH",
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    throw new Error(await parseSupabaseError(response));
  }

  return (await response.json()) as T;
}

async function deleteSupabaseOrder(orderId: string) {
  const url = getSupabaseRestUrl("orders");

  if (!url || !serviceRoleKey) {
    return;
  }

  await fetch(`${url}?id=eq.${encodeURIComponent(orderId)}`, {
    method: "DELETE",
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
    },
  });
}

async function deleteSupabaseOrderItems(orderId: string) {
  const url = getSupabaseRestUrl("order_items");

  if (!url || !serviceRoleKey) {
    throw new Error(getSupabaseAdminConfigError() ?? "Supabase is not configured");
  }

  const response = await fetch(`${url}?order_id=eq.${encodeURIComponent(orderId)}`, {
    method: "DELETE",
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
    },
  });

  if (!response.ok) {
    throw new Error(await parseSupabaseError(response));
  }
}

export async function updateOrderTelegramMessageId(orderId: string, telegramMessageId: string) {
  const url = getSupabaseRestUrl("orders");

  if (!url || !serviceRoleKey) {
    throw new Error(getSupabaseAdminConfigError() ?? "Supabase is not configured");
  }

  const response = await fetch(`${url}?id=eq.${encodeURIComponent(orderId)}`, {
    method: "PATCH",
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
      "Content-Type": "application/json",
      Prefer: "return=minimal",
    },
    body: JSON.stringify({
      telegram_message_id: telegramMessageId,
    }),
  });

  if (!response.ok) {
    throw new Error(await parseSupabaseError(response));
  }
}

export async function updateOrderWhatsAppMessageId(orderId: string, whatsappMessageId: string) {
  const url = getSupabaseRestUrl("orders");

  if (!url || !serviceRoleKey) {
    return;
  }

  const response = await fetch(`${url}?id=eq.${encodeURIComponent(orderId)}`, {
    method: "PATCH",
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
      "Content-Type": "application/json",
      Prefer: "return=minimal",
    },
    body: JSON.stringify({
      whatsapp_message_id: whatsappMessageId,
    }),
  });

  if (!response.ok) {
    console.error("[whatsapp] Failed to update whatsapp_message_id:", await parseSupabaseError(response));
  }
}

export async function fetchCatalogProductOverrides() {
  if (getSupabaseAdminConfigError()) {
    return [];
  }

  const params = new URLSearchParams({
    select: "*",
    order: "updated_at.desc",
  });

  try {
    return await supabaseGet<CatalogProductOverride[]>(
      "catalog_product_overrides",
      params.toString(),
    );
  } catch (error) {
    if (isCatalogOverridesMigrationMissing(error)) {
      return [];
    }

    throw error;
  }
}

export async function fetchAppSettings() {
  if (getSupabaseAdminConfigError()) {
    return [];
  }

  try {
    return await supabaseGet<AppSetting[]>("app_settings", "select=*&order=key.asc");
  } catch (error) {
    if (isAppSettingsMigrationMissing(error)) {
      return [];
    }

    throw error;
  }
}

export async function upsertAppSetting(key: string, value: string) {
  const [setting] = await supabaseUpsert<AppSetting[]>(
    "app_settings",
    {
      key,
      updated_at: new Date().toISOString(),
      value,
    },
    "key",
  );

  return setting ?? null;
}

export async function upsertCatalogProductOverride(
  productId: string,
  patch: Omit<Partial<CatalogProductOverride>, "product_id" | "updated_at">,
) {
  const cleanPatch = Object.fromEntries(
    Object.entries(patch).filter(([, value]) => value !== undefined),
  );
  const [override] = await supabaseUpsert<CatalogProductOverride[]>(
    "catalog_product_overrides",
    {
      ...cleanPatch,
      product_id: productId,
      updated_at: new Date().toISOString(),
    },
    "product_id",
  );

  return override ?? null;
}

export async function fetchProductStopEvents({ activeOnly = false } = {}) {
  if (getSupabaseAdminConfigError()) {
    return [];
  }

  const params = new URLSearchParams({
    select: "*",
    order: "started_at.desc",
    limit: "100",
  });

  if (activeOnly) {
    params.set("ended_at", "is.null");
  }

  try {
    return await supabaseGet<ProductStopEvent[]>("product_stop_events", params.toString());
  } catch (error) {
    if (isStopEventsMigrationMissing(error)) {
      return [];
    }

    throw error;
  }
}

export async function putProductOnStop({
  productId,
  productName,
  reason,
  reportedByChatId,
  source = "admin",
}: {
  productId: string;
  productName: string;
  reason?: string | null;
  reportedByChatId?: string | null;
  source?: string;
}) {
  const activeEvents = await fetchProductStopEvents({ activeOnly: true });
  const existingEvent = activeEvents.find((event) => event.product_id === productId);

  if (existingEvent) {
    await upsertCatalogProductOverride(productId, {
  is_active: true,   // товар остаётся виден
  stock_qty: 0,      // но нельзя добавить в корзину
});

    return existingEvent;
  }

  const [event] = await supabaseRequest<ProductStopEvent[]>("product_stop_events", {
    product_id: productId,
    product_name: productName,
    reason: reason ?? null,
    reported_by_chat_id: reportedByChatId ?? null,
    source,
  });

  await upsertCatalogProductOverride(productId, {
  is_active: true,   // товар остаётся виден
  stock_qty: 0,      // но нельзя добавить в корзину
});

  return event ?? null;
}

export async function clearProductStop(productId: string) {
  const params = new URLSearchParams({
    ended_at: "is.null",
    product_id: `eq.${productId}`,
  });
  const events = await supabasePatch<ProductStopEvent[]>(
    "product_stop_events",
    params.toString(),
    {
      ended_at: new Date().toISOString(),
    },
  );

  await upsertCatalogProductOverride(productId, {
  is_active: true,
  stock_qty: null,  // null → вернёт original stock из статичного файла
});

  return events;
}

export async function insertOrderWithItems(order: Order, items: OrderItem[]) {
  const nextOrderPayload = {
    id: order.id,
    order_number: order.order_number,
    source: order.source ?? "website",
    company_name: order.company_name,
    customer_bin: order.customer_bin ?? null,
    customer_name: order.customer_name,
    customer_phone: order.customer_phone,
    customer_email: order.customer_email ?? null,
    delivery_address: order.delivery_address ?? null,
    delivery_date: order.delivery_date ?? null,
    delivery_time: order.delivery_time ?? null,
    payment_method: order.payment_method ?? null,
    request_avr: order.request_avr ?? false,
    comment: order.comment ?? null,
    status: order.status,
    total_amount: order.total_amount,
    payment_status: order.payment_status ?? "unpaid",
    payment_provider: order.payment_provider ?? null,
    payment_url: order.payment_url ?? null,
    payment_id: order.payment_id ?? null,
    telegram_message_id: order.telegram_message_id ?? null,
    whatsapp_message_id: order.whatsapp_message_id ?? null,
    confirmed_at: order.confirmed_at ?? null,
    payment_link_sent_at: order.payment_link_sent_at ?? null,
    paid_at: order.paid_at ?? null,
    canceled_at: order.canceled_at ?? null,
    created_at: order.created_at,
  } satisfies SupabaseOrderPayload;

  const legacyOrderPayload = {
    id: order.id,
    order_number: order.order_number,
    company_name: order.company_name,
    customer_name: order.customer_name,
    customer_phone: order.customer_phone,
    customer_email: order.customer_email ?? null,
    delivery_address: order.delivery_address ?? null,
    delivery_date: order.delivery_date ?? null,
    delivery_time: order.delivery_time ?? null,
    payment_method: order.payment_method ?? null,
    comment: order.comment ?? null,
    status: order.status === "pending_manager_confirmation" ? "new" : order.status,
    total_amount: order.total_amount,
    telegram_message_id: order.telegram_message_id ?? null,
    created_at: order.created_at,
  };

  let insertedOrder: Order;

  try {
    [insertedOrder] = await supabaseRequest<Order[]>("orders", nextOrderPayload);
  } catch (error) {
    if (isOrderDocumentsMigrationMissing(error)) {
      const compatibleOrderPayload: Partial<SupabaseOrderPayload> = {
        ...nextOrderPayload,
      };
      delete compatibleOrderPayload.request_avr;

      try {
        [insertedOrder] = await supabaseRequest<Order[]>("orders", compatibleOrderPayload);
      } catch (compatibleError) {
        if (!isPaymentFlowMigrationMissing(compatibleError)) {
          throw compatibleError;
        }

        [insertedOrder] = await supabaseRequest<Order[]>("orders", legacyOrderPayload);
      }
    } else {
      if (!isPaymentFlowMigrationMissing(error)) {
        throw error;
      }

      [insertedOrder] = await supabaseRequest<Order[]>("orders", legacyOrderPayload);
    }
  }

  try {
    const insertedItems = await supabaseRequest<OrderItem[]>(
      "order_items",
      items.map(
        (item): SupabaseOrderItemPayload => ({
          id: item.id,
          order_id: item.order_id,
          product_id: item.product_id,
          product_name: item.product_name,
          unit: item.unit,
          qty: item.qty,
          price: item.price,
          total_amount: item.total_amount,
        }),
      ),
    );

    return {
      order: insertedOrder,
      items: insertedItems,
    };
  } catch (error) {
    await deleteSupabaseOrder(order.id);
    throw error;
  }
}

export async function fetchAdminOrders(status?: OrderStatus) {
  const params = new URLSearchParams({
    select:
      "id,order_number,source,company_name,customer_name,customer_phone,status,payment_status,total_amount,created_at,delivery_date",
    order: "created_at.desc",
    limit: "100",
  });

  if (status) {
    params.set("status", `eq.${status}`);
  }

  return supabaseGet<Order[]>("orders", params.toString());
}

export async function fetchClientOrderSummaries({
  email,
  phone,
}: {
  email?: string;
  phone?: string;
}) {
  const params = new URLSearchParams({
    select:
      "id,order_number,company_name,status,payment_status,revision_note,total_amount,delivery_date,payment_url,created_at,order_items(id,product_name,unit,qty,price,total_amount)",
    order: "created_at.desc",
    limit: "20",
  });
  const filters: string[] = [];

  if (email) {
    filters.push(`customer_email.eq.${email}`);
  }

  if (phone) {
    filters.push(`customer_phone.eq.${phone}`);
  }

  if (filters.length > 1) {
    params.set("or", `(${filters.join(",")})`);
  } else if (email) {
    params.set("customer_email", `eq.${email}`);
  } else if (phone) {
    params.set("customer_phone", `eq.${phone}`);
  }

  return supabaseGet<ClientOrderSummary[]>("orders", params.toString());
}

export async function fetchAdminOrder(orderId: string) {
  const params = new URLSearchParams({
    select: "*",
    id: `eq.${orderId}`,
    limit: "1",
  });
  const orders = await supabaseGet<Order[]>("orders", params.toString());

  return orders[0] ?? null;
}

export async function fetchLatestWhatsAppOrderByPhone(phone: string) {
  const params = new URLSearchParams({
    select: "*",
    customer_phone: `eq.${phone}`,
    source: "eq.whatsapp",
    order: "created_at.desc",
    limit: "1",
  });

  try {
    const orders = await supabaseGet<Order[]>("orders", params.toString());
    return orders[0] ?? null;
  } catch (error) {
    if (!isPaymentFlowMigrationMissing(error)) {
      throw error;
    }
  }

  const fallbackParams = new URLSearchParams({
    select: "*",
    customer_phone: `eq.${phone}`,
    order: "created_at.desc",
    limit: "1",
  });
  const orders = await supabaseGet<Order[]>("orders", fallbackParams.toString());

  return orders[0] ?? null;
}

export async function updateOrderCustomerDetails(
  orderId: string,
  patch: OrderCustomerDetailsPatch,
) {
  const body = Object.fromEntries(
    Object.entries(patch).filter(([, value]) => value !== undefined),
  );

  if (Object.keys(body).length === 0) {
    return fetchAdminOrder(orderId);
  }

  const params = new URLSearchParams({
    id: `eq.${orderId}`,
  });
  const [order] = await supabasePatch<Order[]>("orders", params.toString(), body);

  return order ?? null;
}

export async function fetchAdminOrderByNumber(orderNumber: string) {
  const params = new URLSearchParams({
    select: "*",
    order_number: `eq.${orderNumber}`,
    limit: "1",
  });
  const orders = await supabaseGet<Order[]>("orders", params.toString());

  return orders[0] ?? null;
}

export async function fetchAdminOrderByWhatsAppMessageId(whatsappMessageId: string) {
  const params = new URLSearchParams({
    select: "*",
    whatsapp_message_id: `eq.${whatsappMessageId}`,
    limit: "1",
  });
  const orders = await supabaseGet<Order[]>("orders", params.toString());

  return orders[0] ?? null;
}

export async function fetchOrderByPaymentId(paymentId: string) {
  const params = new URLSearchParams({
    select: "*",
    payment_id: `eq.${paymentId}`,
    limit: "1",
  });
  const orders = await supabaseGet<Order[]>("orders", params.toString());

  return orders[0] ?? null;
}

export async function fetchAdminOrderItems(orderId: string) {
  const params = new URLSearchParams({
    select: "*",
    order_id: `eq.${orderId}`,
    order: "created_at.asc",
  });

  return supabaseGet<OrderItem[]>("order_items", params.toString());
}

export async function updateAdminOrderStatus(orderId: string, status: OrderStatus) {
  const params = new URLSearchParams({
    id: `eq.${orderId}`,
  });
  const [order] = await supabasePatch<Order[]>("orders", params.toString(), { status });

  return order ?? null;
}

export async function updateOrderAvrRequest(orderId: string, requestAvr: boolean) {
  const params = new URLSearchParams({
    id: `eq.${orderId}`,
  });
  const [order] = await supabasePatch<Order[]>("orders", params.toString(), {
    request_avr: requestAvr,
  });

  return order ?? null;
}

export async function cancelOrder(
  orderId: string,
  actor: OrderCancellationActor,
  reason?: string | null,
) {
  const params = new URLSearchParams({
    id: `eq.${orderId}`,
  });
  const now = new Date().toISOString();
  const [order] = await supabasePatch<Order[]>("orders", params.toString(), {
    canceled_at: now,
    cancellation_actor: actor,
    cancellation_reason: reason ?? null,
    status: "canceled",
  });

  return order ?? null;
}

export async function acceptOrderRevision(orderId: string) {
  const params = new URLSearchParams({
    id: `eq.${orderId}`,
  });
  const [order] = await supabasePatch<Order[]>("orders", params.toString(), {
    client_response_at: new Date().toISOString(),
    status: "pending_manager_confirmation",
  });

  return order ?? null;
}

export async function replaceAdminOrderItems({
  items,
  note,
  orderId,
}: {
  items: OrderRevisionItemInput[];
  note?: string | null;
  orderId: string;
}) {
  const cleanItems = items.filter((item) => Number.isFinite(item.qty) && item.qty > 0);

  if (cleanItems.length === 0) {
    throw new Error("Order must contain at least one item");
  }

  await deleteSupabaseOrderItems(orderId);

  const orderItems = await supabaseRequest<OrderItem[]>(
    "order_items",
    cleanItems.map((item) => ({
      id: crypto.randomUUID(),
      order_id: orderId,
      product_id: item.product_id,
      product_name: item.product_name,
      unit: item.unit,
      qty: item.qty,
      price: item.price,
      total_amount: item.price * item.qty,
    })),
  );
  const totalAmount = orderItems.reduce((sum, item) => sum + item.total_amount, 0);
  const params = new URLSearchParams({
    id: `eq.${orderId}`,
  });
  const [order] = await supabasePatch<Order[]>("orders", params.toString(), {
    payment_status: "unpaid",
    payment_url: null,
    revision_note: note ?? null,
    revision_payload: {
      items: orderItems.map((item) => ({
        price: item.price,
        product_id: item.product_id,
        product_name: item.product_name,
        qty: item.qty,
        total_amount: item.total_amount,
        unit: item.unit,
      })),
      note: note ?? null,
    },
    revision_requested_at: new Date().toISOString(),
    status: "change_proposed",
    total_amount: totalAmount,
  });

  return {
    items: orderItems,
    order: order ?? null,
  };
}

export async function confirmAdminOrder(orderId: string, patch: OrderConfirmationPatch) {
  const params = new URLSearchParams({
    id: `eq.${orderId}`,
  });
  const [order] = await supabasePatch<Order[]>("orders", params.toString(), patch);

  return order ?? null;
}

export async function markOrderPaid(orderId: string) {
  const params = new URLSearchParams({
    id: `eq.${orderId}`,
  });
  const [order] = await supabasePatch<Order[]>("orders", params.toString(), {
    paid_at: new Date().toISOString(),
    payment_status: "paid",
    status: "paid",
  });

  return order ?? null;
}

export async function updateOrderPaymentStatus(
  orderId: string,
  paymentStatus: PaymentStatus,
  orderStatus?: OrderStatus,
) {
  const params = new URLSearchParams({
    id: `eq.${orderId}`,
  });
  const patch: Record<string, string> = {
    payment_status: paymentStatus,
  };

  if (orderStatus) {
    patch.status = orderStatus;
  }

  if (paymentStatus === "paid") {
    patch.paid_at = new Date().toISOString();
  }

  const [order] = await supabasePatch<Order[]>("orders", params.toString(), patch);

  return order ?? null;
}

export async function insertPaymentEvent(event: PaymentEventPayload) {
  try {
    await supabaseRequest("payment_events", event);
  } catch (error) {
    console.error("[payments] Failed to log payment event:", error);
  }
}
