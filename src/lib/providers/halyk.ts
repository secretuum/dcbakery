import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";

// Адаптер Halyk ePay (epayment.kz). Без env-ключей интеграция полностью
// выключена (isHalykConfigured() === false) — поведение сайта не меняется.
//
// Поток: сервер получает OAuth-токен с суммой и invoiceID → клиенту отдаётся
// готовый token-объект → JS-библиотека Halyk открывает платёжную страницу →
// Halyk шлёт postLink → мы НЕ доверяем телу и подтверждаем оплату запросом
// check-status. Секреты (ClientSecret) браузеру не передаются.

export type HalykConfig = {
  clientId: string;
  clientSecret: string;
  terminalId: string;
  oauthUrl: string;
  checkStatusUrl: string;
  paymentJsUrl: string;
  isProduction: boolean;
};

export function getHalykConfig(): HalykConfig | null {
  const clientId = process.env.HALYK_CLIENT_ID?.trim();
  const clientSecret = process.env.HALYK_CLIENT_SECRET?.trim();
  const terminalId = process.env.HALYK_TERMINAL_ID?.trim();

  if (!clientId || !clientSecret || !terminalId) {
    return null;
  }

  const isProduction = process.env.HALYK_ENV?.trim().toLowerCase() === "production";

  return {
    clientId,
    clientSecret,
    terminalId,
    isProduction,
    oauthUrl: isProduction
      ? "https://epay-oauth.homebank.kz/oauth2/token"
      : "https://test-epay-oauth.epayment.kz/oauth2/token",
    checkStatusUrl: isProduction
      ? "https://epay-api.homebank.kz/check-status/payment/transaction"
      : "https://test-epay-api.epayment.kz/check-status/payment/transaction",
    paymentJsUrl: isProduction
      ? "https://epay.homebank.kz/payform/payment-api.js"
      : "https://test-epay.epayment.kz/payform/payment-api.js",
  };
}

export function isHalykConfigured() {
  return getHalykConfig() !== null;
}

function getHalykHashSecret() {
  return (
    process.env.HALYK_PAY_SECRET?.trim() ||
    process.env.PAYMENT_WEBHOOK_SECRET?.trim() ||
    ""
  );
}

/** secret_hash попытки: уходит в token-запрос, возвращается в postLink — сверяем. */
export function createHalykSecretHash(invoiceId: string | number) {
  const secret = getHalykHashSecret();

  if (!secret) {
    throw new Error("HALYK_PAY_SECRET (или PAYMENT_WEBHOOK_SECRET) не задан");
  }

  return createHmac("sha256", secret).update(`halyk:${invoiceId}`).digest("hex");
}

export function verifyHalykSecretHash(invoiceId: string | number, providedHash: string) {
  try {
    const expected = Buffer.from(createHalykSecretHash(invoiceId));
    const provided = Buffer.from(providedHash);
    return expected.length === provided.length && timingSafeEqual(expected, provided);
  } catch {
    return false;
  }
}

export type HalykPaymentAuth = Record<string, unknown>;

/**
 * OAuth-токен под конкретный платёж (scope payment + сумма + invoiceID).
 * Возвращённый объект передаётся клиентскому halyk.pay() как `auth`.
 */
export async function createHalykPaymentAuth(params: {
  invoiceId: string;
  amount: number;
  postLink: string;
  failurePostLink: string;
}): Promise<HalykPaymentAuth> {
  const config = getHalykConfig();

  if (!config) {
    throw new Error("Halyk ePay не настроен: задайте HALYK_CLIENT_ID / HALYK_CLIENT_SECRET / HALYK_TERMINAL_ID");
  }

  const form = new URLSearchParams({
    grant_type: "client_credentials",
    scope: "webapi usermanagement email_send verification statement statistics payment",
    client_id: config.clientId,
    client_secret: config.clientSecret,
    invoiceID: params.invoiceId,
    secret_hash: createHalykSecretHash(params.invoiceId),
    amount: String(params.amount),
    currency: "KZT",
    terminal: config.terminalId,
    postLink: params.postLink,
    failurePostLink: params.failurePostLink,
  });

  const response = await fetch(config.oauthUrl, {
    method: "POST",
    body: form,
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Halyk OAuth failed: ${response.status} ${await response.text()}`);
  }

  return (await response.json()) as HalykPaymentAuth;
}

/** Технический токен для запросов статуса (без суммы). */
async function createHalykServiceToken(): Promise<string> {
  const config = getHalykConfig();

  if (!config) {
    throw new Error("Halyk ePay не настроен");
  }

  const form = new URLSearchParams({
    grant_type: "client_credentials",
    scope: "webapi payment",
    client_id: config.clientId,
    client_secret: config.clientSecret,
    terminal: config.terminalId,
  });

  const response = await fetch(config.oauthUrl, { method: "POST", body: form, cache: "no-store" });

  if (!response.ok) {
    throw new Error(`Halyk OAuth failed: ${response.status} ${await response.text()}`);
  }

  const data = (await response.json()) as { access_token?: string };

  if (!data.access_token) {
    throw new Error("Halyk OAuth: access_token отсутствует в ответе");
  }

  return data.access_token;
}

export type HalykTransactionStatus = {
  /** CHARGE | AUTH | CANCEL | REFUND | FAILED | REJECT | 3D | VERIFIED | NOT_FOUND */
  statusName: string;
  transactionId?: string;
  amount?: number;
  currency?: string;
  raw: unknown;
};

const NOT_FOUND_CODE = 102;

/** Сервер-сервер проверка статуса транзакции — единственный источник истины об оплате. */
export async function checkHalykStatus(invoiceId: string | number): Promise<HalykTransactionStatus> {
  const config = getHalykConfig();

  if (!config) {
    throw new Error("Halyk ePay не настроен");
  }

  const token = await createHalykServiceToken();
  const response = await fetch(`${config.checkStatusUrl}/${invoiceId}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  const raw = (await response.json().catch(() => ({}))) as Record<string, unknown>;

  if (!response.ok) {
    throw new Error(`Halyk check-status failed: ${response.status} ${JSON.stringify(raw).slice(0, 300)}`);
  }

  const resultCode = Number(raw.resultCode ?? raw.code ?? 100);

  if (resultCode === NOT_FOUND_CODE) {
    return { statusName: "NOT_FOUND", raw };
  }

  const transaction = (raw.transaction ?? raw) as Record<string, unknown>;

  return {
    statusName: String(transaction.statusName ?? transaction.status ?? "").toUpperCase(),
    transactionId: transaction.id ? String(transaction.id) : undefined,
    amount: typeof transaction.amount === "number" ? transaction.amount : Number(transaction.amount) || undefined,
    currency: transaction.currency ? String(transaction.currency) : undefined,
    raw,
  };
}

/** Статусы Halyk, означающие успешное списание/холд. */
export function isHalykPaidStatus(statusName: string) {
  return statusName === "CHARGE" || statusName === "AUTH";
}
