import "server-only";

export type WhatsAppCartItem = {
  productId: string;
  qty: number;
};

export type WhatsAppCart = {
  chatId: string;
  customerPhone?: string | null;
  items: WhatsAppCartItem[];
  senderName?: string | null;
};

type WhatsAppCartRow = {
  chat_id: string;
  customer_phone?: string | null;
  items?: unknown;
  sender_name?: string | null;
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

function normalizeItems(value: unknown): WhatsAppCartItem[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => {
      if (typeof item !== "object" || item === null) {
        return null;
      }

      const productId = "productId" in item ? item.productId : null;
      const qty = "qty" in item ? item.qty : null;

      if (typeof productId !== "string" || typeof qty !== "number" || !Number.isFinite(qty)) {
        return null;
      }

      return qty > 0 ? { productId, qty } : null;
    })
    .filter((item): item is WhatsAppCartItem => Boolean(item));
}

function toCart(row: WhatsAppCartRow): WhatsAppCart {
  return {
    chatId: row.chat_id,
    customerPhone: row.customer_phone ?? null,
    items: normalizeItems(row.items),
    senderName: row.sender_name ?? null,
  };
}

export async function fetchWhatsAppCart(chatId: string) {
  const url = getSupabaseRestUrl("whatsapp_carts");

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

  const rows = (await response.json()) as WhatsAppCartRow[];

  return rows[0] ? toCart(rows[0]) : { chatId, items: [] };
}

export async function saveWhatsAppCart(cart: WhatsAppCart) {
  const url = getSupabaseRestUrl("whatsapp_carts");

  if (!url || !serviceRoleKey) {
    throw new Error("Supabase is not configured");
  }

  const response = await fetch(`${url}?on_conflict=chat_id`, {
    method: "POST",
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
      "Content-Type": "application/json",
      Prefer: "resolution=merge-duplicates,return=representation",
    },
    body: JSON.stringify({
      chat_id: cart.chatId,
      customer_phone: cart.customerPhone ?? null,
      items: cart.items,
      sender_name: cart.senderName ?? null,
    }),
  });

  if (!response.ok) {
    throw new Error(await parseSupabaseError(response));
  }

  const rows = (await response.json()) as WhatsAppCartRow[];

  return rows[0] ? toCart(rows[0]) : cart;
}

export async function clearWhatsAppCart(chatId: string) {
  const url = getSupabaseRestUrl("whatsapp_carts");

  if (!url || !serviceRoleKey) {
    throw new Error("Supabase is not configured");
  }

  const response = await fetch(`${url}?chat_id=eq.${encodeURIComponent(chatId)}`, {
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
