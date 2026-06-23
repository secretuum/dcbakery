import "server-only";

export type WhatsAppClientProfile = {
  chatId: string;
  customerPhone?: string | null;
  companyName?: string | null;
  customerBin?: string | null;
  customerName?: string | null;
  customerEmail?: string | null;
  deliveryAddress?: string | null;
  deliveryDate?: string | null;
  deliveryTime?: string | null;
  paymentMethod?: string | null;
  comment?: string | null;
  lastOrderId?: string | null;
};

type WhatsAppClientRow = {
  chat_id: string;
  customer_phone?: string | null;
  company_name?: string | null;
  customer_bin?: string | null;
  customer_name?: string | null;
  customer_email?: string | null;
  delivery_address?: string | null;
  delivery_date?: string | null;
  delivery_time?: string | null;
  payment_method?: string | null;
  comment?: string | null;
  last_order_id?: string | null;
};

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

function getSupabaseRestUrl(table: string) {
  if (!supabaseUrl) {
    return null;
  }

  return `${supabaseUrl.replace(/\/$/, "")}/rest/v1/${table}`;
}

async function parseSupabaseError(response: Response) {
  try {
    const error = (await response.json()) as { message?: string };
    return error.message ?? response.statusText;
  } catch {
    return response.statusText;
  }
}

function toProfile(row: WhatsAppClientRow): WhatsAppClientProfile {
  return {
    chatId: row.chat_id,
    companyName: row.company_name ?? null,
    customerBin: row.customer_bin ?? null,
    customerEmail: row.customer_email ?? null,
    customerName: row.customer_name ?? null,
    customerPhone: row.customer_phone ?? null,
    deliveryAddress: row.delivery_address ?? null,
    deliveryDate: row.delivery_date ?? null,
    deliveryTime: row.delivery_time ?? null,
    paymentMethod: row.payment_method ?? null,
    comment: row.comment ?? null,
    lastOrderId: row.last_order_id ?? null,
  };
}

function setIfDefined(
  target: Record<string, unknown>,
  key: string,
  value: string | null | undefined,
) {
  if (value !== undefined) {
    target[key] = value;
  }
}

export async function fetchWhatsAppClientByChatId(chatId: string) {
  const url = getSupabaseRestUrl("whatsapp_clients");

  if (!url || !serviceRoleKey) {
    throw new Error("Supabase is not configured");
  }

  const params = new URLSearchParams({
    chat_id: `eq.${chatId}`,
    limit: "1",
    select: "*",
  });
  const response = await fetch(`${url}?${params.toString()}`, {
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
    },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(await parseSupabaseError(response));
  }

  const rows = (await response.json()) as WhatsAppClientRow[];

  return rows[0] ? toProfile(rows[0]) : null;
}

export async function saveWhatsAppClientProfile(profile: WhatsAppClientProfile) {
  const url = getSupabaseRestUrl("whatsapp_clients");

  if (!url || !serviceRoleKey) {
    throw new Error("Supabase is not configured");
  }

  const body: Record<string, unknown> = {
    chat_id: profile.chatId,
  };

  setIfDefined(body, "customer_phone", profile.customerPhone);
  setIfDefined(body, "company_name", profile.companyName);
  setIfDefined(body, "customer_bin", profile.customerBin);
  setIfDefined(body, "customer_name", profile.customerName);
  setIfDefined(body, "customer_email", profile.customerEmail);
  setIfDefined(body, "delivery_address", profile.deliveryAddress);
  setIfDefined(body, "delivery_date", profile.deliveryDate);
  setIfDefined(body, "delivery_time", profile.deliveryTime);
  setIfDefined(body, "payment_method", profile.paymentMethod);
  setIfDefined(body, "comment", profile.comment);
  setIfDefined(body, "last_order_id", profile.lastOrderId);

  const response = await fetch(`${url}?on_conflict=chat_id`, {
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

  const rows = (await response.json()) as WhatsAppClientRow[];

  return rows[0] ? toProfile(rows[0]) : profile;
}
