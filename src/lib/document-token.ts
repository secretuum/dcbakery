import "server-only";

// Подписанный токен доступа к документам заказа (счёт/накладная/АВР).
// URL работает как возможность: кто владеет ссылкой с валидным токеном — видит документ.
// Stateless HMAC: без БД. Отзыв всех выданных токенов = ротация DOCUMENT_TOKEN_SECRET.

const DEFAULT_TTL_MS = 90 * 24 * 60 * 60 * 1000; // 90 дней — счёт остаётся доступен

function secret() {
  const value = process.env.DOCUMENT_TOKEN_SECRET || process.env.CLIENT_SESSION_SECRET;
  if (value && value.length > 0) return value;
  if (process.env.NODE_ENV === "production") {
    throw new Error("DOCUMENT_TOKEN_SECRET is not set — refusing insecure fallback in production");
  }
  return "dev-only-insecure-please-set-env";
}

async function hmacKey(usage: "sign" | "verify") {
  return crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    [usage],
  );
}

async function sig(orderId: string, expMs: number): Promise<string> {
  const key = await hmacKey("sign");
  const buf = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`${orderId}.${expMs}`));
  return Buffer.from(buf).toString("hex");
}

/** Токен для ссылки на документ конкретного заказа. */
export async function signDocumentToken(orderId: string, ttlMs = DEFAULT_TTL_MS): Promise<string> {
  const expMs = Date.now() + ttlMs;
  const expB64 = Buffer.from(String(expMs)).toString("base64url");
  return `${expB64}.${await sig(orderId, expMs)}`;
}

/** true, если токен валиден для этого orderId и не истёк. Сравнение — в постоянное время. */
export async function verifyDocumentToken(orderId: string, token: string | null | undefined): Promise<boolean> {
  if (!token) return false;
  const dot = token.lastIndexOf(".");
  if (dot === -1) return false;
  const expMs = Number(Buffer.from(token.slice(0, dot), "base64url").toString());
  if (!Number.isFinite(expMs) || expMs < Date.now()) return false;
  const provided = token.slice(dot + 1);
  const expected = await sig(orderId, expMs);
  // timing-safe: равная длина hex + crypto.subtle.verify-эквивалент через сравнение байт
  if (provided.length !== expected.length) return false;
  const a = Buffer.from(provided, "hex");
  const b = Buffer.from(expected, "hex");
  if (a.length !== b.length || a.length === 0) return false;
  const { timingSafeEqual } = await import("node:crypto");
  return timingSafeEqual(a, b);
}