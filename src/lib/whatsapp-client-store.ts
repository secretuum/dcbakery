import "server-only";

export type WhatsAppClientAddress = {
  label?: string | null;
  address: string;
  comment?: string | null;
};

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
  addresses?: WhatsAppClientAddress[];
  primaryAddressIndex?: number | null;
  lastOrderId?: string | null;
  accountantPhone?: string | null;
};

function hasMeaningfulValue(value?: string | null) {
  const normalizedValue = value?.trim().toLowerCase();

  return Boolean(
    normalizedValue &&
      normalizedValue !== "null" &&
      normalizedValue !== "не указано" &&
      normalizedValue !== "whatsapp клиент",
  );
}

export function isWhatsAppClientProfileComplete(
  profile?: WhatsAppClientProfile | null,
) {
  if (!profile) {
    return false;
  }

  return Boolean(
    hasMeaningfulValue(profile.companyName) &&
      hasMeaningfulValue(profile.customerBin) &&
      hasMeaningfulValue(profile.customerName) &&
      hasMeaningfulValue(profile.customerEmail) &&
      ((profile.addresses?.length ?? 0) > 0 ||
        hasMeaningfulValue(profile.deliveryAddress)),
  );
}

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
  addresses?: unknown;
  primary_address_index?: number | null;
  last_order_id?: string | null;
  accountant_phone?: string | null;
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
  const addresses = normalizeAddresses(row.addresses);

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
    addresses,
    primaryAddressIndex: row.primary_address_index ?? 0,
    lastOrderId: row.last_order_id ?? null,
    accountantPhone: row.accountant_phone ?? null,
  };
}

export function normalizeAddresses(value: unknown): WhatsAppClientAddress[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const addresses: WhatsAppClientAddress[] = [];

  for (const item of value) {
    if (typeof item === "string") {
      if (item.trim()) {
        addresses.push({ address: item.trim() });
      }

      continue;
    }

    if (typeof item !== "object" || item === null) {
      continue;
    }

    const address = "address" in item ? item.address : null;
    const label = "label" in item ? item.label : null;
    const comment = "comment" in item ? item.comment : null;

    if (typeof address === "string" && address.trim()) {
      addresses.push({
        address: address.trim(),
        comment: typeof comment === "string" && comment.trim() ? comment.trim() : null,
        label: typeof label === "string" && label.trim() ? label.trim() : null,
      });
    }
  }

  return addresses;
}

export function mergeClientAddressList(
  current: WhatsAppClientAddress[] = [],
  address?: string | null,
) {
  const nextAddress = address?.trim();

  if (!nextAddress) {
    return current;
  }

  const exists = current.some(
    (item) => item.address.trim().toLowerCase() === nextAddress.toLowerCase(),
  );

  return exists ? current : [...current, { address: nextAddress }];
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

export async function fetchWhatsAppClients() {
  const url = getSupabaseRestUrl("whatsapp_clients");

  if (!url || !serviceRoleKey) {
    throw new Error("Supabase is not configured");
  }

  const params = new URLSearchParams({
    order: "updated_at.desc",
    select: "*",
    limit: "200",
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

  return rows.map(toProfile);
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

  if (profile.addresses !== undefined) {
    body.addresses = profile.addresses;
  }

  if (profile.primaryAddressIndex !== undefined) {
    body.primary_address_index = profile.primaryAddressIndex;
  }

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
