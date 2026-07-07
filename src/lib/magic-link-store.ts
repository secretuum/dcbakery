import "server-only";

const supabaseUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").replace(/\/$/, "");
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

function dbUrl(table: string) {
  if (!supabaseUrl || !serviceRoleKey) return null;
  return `${supabaseUrl}/rest/v1/${table}`;
}

function serviceHeaders() {
  return {
    apikey: serviceRoleKey,
    Authorization: `Bearer ${serviceRoleKey}`,
    "Content-Type": "application/json",
    Prefer: "return=representation",
  };
}

export async function createMagicLinkToken({
  email,
  token,
  expiresAt,
}: {
  email: string;
  token: string;
  expiresAt: Date;
}): Promise<void> {
  const url = dbUrl("magic_link_tokens");
  if (!url) throw new Error("Supabase not configured");

  const res = await fetch(url, {
    method: "POST",
    headers: serviceHeaders(),
    body: JSON.stringify({ email, token, expires_at: expiresAt.toISOString() }),
  });

  if (!res.ok) {
    const msg = await res.text().catch(() => res.statusText);
    throw new Error(`Failed to create magic link token: ${msg}`);
  }
}

export async function consumeMagicLinkToken(
  token: string,
): Promise<{ email: string } | null> {
  const url = dbUrl("magic_link_tokens");
  if (!url) return null;

  const params = new URLSearchParams({
    token: `eq.${token}`,
    used: "eq.false",
    expires_at: `gt.${new Date().toISOString()}`,
  });

  const res = await fetch(`${url}?${params.toString()}`, {
    method: "PATCH",
    headers: serviceHeaders(),
    body: JSON.stringify({ used: true }),
  });

  if (!res.ok) return null;

  const rows = (await res.json()) as Array<{ email: string }>;
  return rows[0] ? { email: rows[0].email } : null;
}

export async function fetchWhatsAppClientByEmail(email: string) {
  const url = dbUrl("whatsapp_clients");
  if (!url) return null;

  const params = new URLSearchParams({
    customer_email: `eq.${email}`,
    limit: "1",
    select: "chat_id,customer_phone,company_name,accountant_phone",
  });

  const res = await fetch(`${url}?${params.toString()}`, {
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
    },
    cache: "no-store",
  });

  if (!res.ok) return null;

  const rows = (await res.json()) as Array<{
    chat_id: string;
    customer_phone?: string | null;
    company_name?: string | null;
    accountant_phone?: string | null;
  }>;

  return rows[0] ?? null;
}
