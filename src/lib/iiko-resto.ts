import "server-only";
import { createHash } from "node:crypto";

// Низкоуровневый клиент iiko resto (iikoOffice) API: sha1-логин, ОБЯЗАТЕЛЬНЫЙ logout
// (лицензии сервера ограничены), импорт расходной накладной. Само-включается: если
// env не заданы — тихо не работает. Структура накладной = 1-в-1 с зондом №3.

function baseUrl(): string {
  let b = (process.env.IIKO_BASE_URL ?? "").replace(/\/$/, "");
  if (b && !/^https?:\/\//i.test(b)) b = `https://${b}`;
  return b;
}

export function iikoRestoConfigured(): boolean {
  return Boolean(baseUrl() && process.env.IIKO_RESTO_LOGIN && process.env.IIKO_RESTO_PASS);
}

async function auth(): Promise<string | null> {
  const base = baseUrl();
  if (!base) return null;
  const sha1 = createHash("sha1").update(process.env.IIKO_RESTO_PASS ?? "").digest("hex");
  try {
    const res = await fetch(
      `${base}/resto/api/auth?login=${encodeURIComponent(process.env.IIKO_RESTO_LOGIN ?? "")}&pass=${sha1}`,
      { cache: "no-store", signal: AbortSignal.timeout(10000) },
    );
    const text = (await res.text()).trim();
    return res.ok && text && !text.includes("<") ? text : null;
  } catch {
    return null;
  }
}

async function logout(key: string) {
  await fetch(`${baseUrl()}/resto/api/logout?key=${key}`, { cache: "no-store" }).catch(() => {});
}

/** Авторизуется, выполняет fn(key), гарантированно разлогинивается. null — если недоступно. */
export async function withIiko<T>(fn: (key: string) => Promise<T>): Promise<T | null> {
  if (!iikoRestoConfigured()) return null;
  const key = await auth();
  if (!key) return null;
  try {
    return await fn(key);
  } finally {
    await logout(key);
  }
}

// ─── Расходная накладная ───────────────────────────────────────────────────────

export type OutgoingInvoiceItem = {
  productId: string;
  storeId: string;
  price: number;
  amount: number;
  sum: number;
};

export type OutgoingInvoiceParams = {
  documentNumber: string;
  dateIncoming: string; // ISO 8601
  status: "NEW" | "PROCESSED";
  storeId: string;
  counteragentId: string;
  revenueAccountCode: string;
  accountToCode: string;
  items: OutgoingInvoiceItem[];
};

function esc(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function buildInvoiceXml(p: OutgoingInvoiceParams): string {
  const items = p.items
    .map(
      (it) =>
        `<item><productId>${it.productId}</productId><storeId>${it.storeId}</storeId>` +
        `<price>${it.price.toFixed(2)}</price><priceWithoutVat>${it.price.toFixed(2)}</priceWithoutVat>` +
        `<amount>${it.amount.toFixed(3)}</amount><sum>${it.sum.toFixed(2)}</sum>` +
        `<discountSum>0.00</discountSum><vatPercent>0</vatPercent><vatSum>0.00</vatSum></item>`,
    )
    .join("");

  return (
    `<?xml version="1.0" encoding="UTF-8"?>` +
    `<document>` +
    `<documentNumber>${esc(p.documentNumber)}</documentNumber>` +
    `<dateIncoming>${p.dateIncoming}</dateIncoming>` +
    `<useDefaultDocumentTime>false</useDefaultDocumentTime>` +
    `<status>${p.status}</status>` +
    `<accountToCode>${p.accountToCode}</accountToCode>` +
    `<revenueAccountCode>${p.revenueAccountCode}</revenueAccountCode>` +
    `<defaultStoreId>${p.storeId}</defaultStoreId>` +
    `<counteragentId>${p.counteragentId}</counteragentId>` +
    `<items>${items}</items>` +
    `</document>`
  );
}

export type ImportResult = { ok: boolean; error?: string };

/** Импорт расходной накладной. iiko отвечает XML с <valid>true/false</valid>. */
export async function importOutgoingInvoice(
  key: string,
  params: OutgoingInvoiceParams,
): Promise<ImportResult> {
  try {
    const res = await fetch(`${baseUrl()}/resto/api/documents/import/outgoingInvoice?key=${key}`, {
      method: "POST",
      headers: { "Content-Type": "application/xml" },
      body: buildInvoiceXml(params),
      cache: "no-store",
      signal: AbortSignal.timeout(15000),
    });
    const text = await res.text();

    if (!res.ok) {
      return { ok: false, error: `HTTP ${res.status}: ${text.slice(0, 200).replace(/\s+/g, " ")}` };
    }

    if (/<valid>\s*false\s*<\/valid>/i.test(text)) {
      const msg = text.match(/<errorMessage>([^<]*)<\/errorMessage>/i)?.[1];
      return { ok: false, error: msg?.trim() || text.slice(0, 200).replace(/\s+/g, " ") };
    }

    return { ok: true };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "iiko import failed" };
  }
}
