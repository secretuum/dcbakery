import "server-only";

type CachedToken = { token: string; expiresAt: number };

let cachedToken: CachedToken | null = null;
let pendingToken: Promise<string> | null = null;

export async function getIikoToken(): Promise<string> {
  if (cachedToken && cachedToken.expiresAt > Date.now()) {
    return cachedToken.token;
  }

  if (pendingToken) {
    return pendingToken;
  }

  pendingToken = fetchIikoToken().finally(() => {
    pendingToken = null;
  });

  return pendingToken;
}

// ─── Organisations ────────────────────────────────────────────────────────────

type IikoOrganization = {
  id: string;
  name: string;
};

export async function getOrganizations(): Promise<IikoOrganization[]> {
  const token = await getIikoToken();
  const res = await fetch(`${process.env.IIKO_BASE_URL}/api/v2/organizations`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ organizationIds: [] }),
  });
  if (!res.ok) throw new Error(`iiko getOrganizations failed: ${res.status}`);
  const data = (await res.json()) as { organizations?: IikoOrganization[] };
  return data.organizations ?? [];
}

// ─── Nomenclature ─────────────────────────────────────────────────────────────

type IikoProduct = {
  id: string;
  name: string;
  code: string;
  measureUnitId: string;
  price?: number;
};

export async function getNomenclature(organizationId: string): Promise<IikoProduct[]> {
  const token = await getIikoToken();
  const res = await fetch(
    `${process.env.IIKO_BASE_URL}/api/v2/nomenclature/${organizationId}`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  if (!res.ok) throw new Error(`iiko getNomenclature failed: ${res.status}`);
  const data = (await res.json()) as { products?: IikoProduct[] };
  return data.products ?? [];
}

// ─── Counter agents (suppliers / clients) ─────────────────────────────────────

type IikoCounterAgent = {
  id: string;
  name: string;
  type: string;
  code?: string;
  taxpayerIdNumber?: string;
};

export async function getCounterAgents(organizationId: string): Promise<IikoCounterAgent[]> {
  const token = await getIikoToken();
  const res = await fetch(`${process.env.IIKO_BASE_URL}/api/v2/suppliers`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ organizationId }),
  });
  if (!res.ok) throw new Error(`iiko getCounterAgents failed: ${res.status}`);
  const data = (await res.json()) as { suppliers?: IikoCounterAgent[] };
  return data.suppliers ?? [];
}

// ─── Outgoing invoice ─────────────────────────────────────────────────────────

type IikoInvoiceItem = {
  productId: string;
  amount: number;
  price: number;
  productSizeId?: string;
};

export type CreateOutgoingInvoiceParams = {
  organizationId: string;
  counterAgentId: string;
  items: IikoInvoiceItem[];
  documentDate?: string;
  comment?: string;
};

export async function createOutgoingInvoice(
  params: CreateOutgoingInvoiceParams,
): Promise<string> {
  const token = await getIikoToken();
  const res = await fetch(
    `${process.env.IIKO_BASE_URL}/api/v2/documents/export/outgoing-invoice`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        organizationId: params.organizationId,
        counterAgentId: params.counterAgentId,
        defaultStore: process.env.IIKO_ORG_ID,
        documentDate: params.documentDate,
        comment: params.comment,
        items: params.items,
      }),
    },
  );
  if (!res.ok) throw new Error(`iiko createOutgoingInvoice failed: ${res.status}`);
  const data = (await res.json()) as { documentId?: string };
  if (!data.documentId) throw new Error("iiko: no documentId in response");
  return data.documentId;
}

// ─── Internal ─────────────────────────────────────────────────────────────────

async function fetchIikoToken(): Promise<string> {
  const res = await fetch(`${process.env.IIKO_BASE_URL}/api/v2/access_token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      apiLogin: process.env.IIKO_API_LOGIN,
      appId: process.env.IIKO_APP_ID,
      clientSecret: process.env.IIKO_CLIENT_SECRET,
    }),
  });

  if (!res.ok) throw new Error(`iiko auth failed: ${res.status}`);

  const data = (await res.json()) as { token?: string };

  if (!data.token) throw new Error("iiko auth: no token in response");

  cachedToken = { token: data.token, expiresAt: Date.now() + 50 * 60 * 1000 };
  return data.token;
}
