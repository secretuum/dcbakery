import "server-only";

// Одноразовый код (OTP) для подтверждения регистрации через WhatsApp.
//
// Хранилища под коды НЕТ (миграции запрещены) — challenge живёт в ПОДПИСАННОЙ
// httpOnly-куке: HMAC-SHA256 по тому же секрету, что и клиентская сессия. В куку
// кладём только ХЭШ кода (не сам код) + личность регистранта + срок. Перебор по
// verify-эндпоинту гасится лимитом по IP. TTL кода — 2 минуты.

export const OTP_CHALLENGE_COOKIE = "dc_otp_challenge";
export const OTP_TTL_MS = 2 * 60 * 1000; // код действителен 2 минуты
export const OTP_COOKIE_MAX_AGE_S = 2 * 60 + 30; // кука чуть дольше — успеть проверить/переслать

export type OtpPurpose = "register" | "verify_phone" | "login";

export type OtpChallenge = {
  purpose: OtpPurpose;
  email: string;
  phone: string;
  chatId: string;
  companyName: string;
  /** id пользователя Supabase — чтобы после кода авто-подтвердить его email */
  userId: string;
  codeHash: string;
  exp: number;
};

function secret() {
  const value = process.env.CLIENT_SESSION_SECRET;
  if (value && value.length > 0) return value;
  // Тот же fail-fast, что и в client-session: без секрета OTP-челленджи подделываемы.
  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "CLIENT_SESSION_SECRET is not set — refusing to use the insecure dev fallback in production",
    );
  }
  return "dev-only-insecure-please-set-env";
}

async function hmacKey() {
  return crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
}

async function hmacHex(input: string): Promise<string> {
  const key = await hmacKey();
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(input));
  return Buffer.from(sig).toString("hex");
}

/** Сравнение строк за постоянное время (защита от timing-атак на код/подпись). */
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

export function generateOtpCode(): string {
  const arr = new Uint32Array(1);
  crypto.getRandomValues(arr);
  return String(arr[0] % 1_000_000).padStart(6, "0");
}

export async function hashOtpCode(code: string): Promise<string> {
  return hmacHex(`otp-code:${code}`);
}

export async function signOtpChallenge(payload: OtpChallenge): Promise<string> {
  const data = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const sig = await hmacHex(data);
  return `${data}.${sig}`;
}

/**
 * Возвращает payload, если подпись верна. НЕ проверяет срок (это делает
 * вызывающий): verify требует свежий код, а resend допускает истёкший challenge,
 * чтобы переслать новый код тому же регистранту.
 */
export async function readOtpChallenge(
  value: string | undefined | null,
  expectedPurpose: OtpPurpose,
): Promise<OtpChallenge | null> {
  if (!value) return null;
  const dot = value.lastIndexOf(".");
  if (dot === -1) return null;

  const data = value.slice(0, dot);
  const sig = value.slice(dot + 1);

  try {
    const expected = await hmacHex(data);
    if (!safeEqual(expected, sig)) return null;

    const payload = JSON.parse(Buffer.from(data, "base64url").toString()) as OtpChallenge;
    if (payload.purpose !== expectedPurpose) return null;
    return payload;
  } catch {
    return null;
  }
}

export function isOtpExpired(challenge: OtpChallenge): boolean {
  return challenge.exp < Date.now();
}

export async function verifyOtpCode(challenge: OtpChallenge, code: string): Promise<boolean> {
  if (typeof code !== "string" || !/^\d{6}$/.test(code)) return false;
  const hash = await hashOtpCode(code);
  return safeEqual(hash, challenge.codeHash);
}

export function formatOtpMessage(code: string): string {
  return [
    "DC Bakery",
    "",
    `Ваш код подтверждения: ${code}`,
    "",
    "Введите его на сайте в течение 2 минут.",
    "Никому не сообщайте этот код.",
  ].join("\n");
}
