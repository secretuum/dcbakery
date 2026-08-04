import { NextResponse } from "next/server";
import { checkRateLimit, getRequestIdentifier } from "@/src/lib/rate-limit";
import { getWhatsAppChatIdFromPhone, sendGreenApiTextMessage } from "@/src/lib/whatsapp";
import { fetchWhatsAppClientByChatId } from "@/src/lib/whatsapp-client-store";
import {
  formatOtpMessage,
  generateOtpCode,
  hashOtpCode,
  signOtpChallenge,
  OTP_CHALLENGE_COOKIE,
  OTP_COOKIE_MAX_AGE_S,
  OTP_TTL_MS,
} from "@/src/lib/otp";

// Беспарольный вход: телефон → код в WhatsApp → общий /api/profile/otp/verify.
// Личность сессии берётся из СОХРАНЁННОГО профиля (не из ввода) — анти-спуфинг.
// Для лайт-аккаунтов без пароля это единственный вход; полным клиентам доступен
// и вход по паролю.

function asString(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

export async function POST(request: Request) {
  const limited = await checkRateLimit({
    identifier: getRequestIdentifier(request),
    limit: 6,
    namespace: "profile:login-code",
    windowMs: 15 * 60 * 1000,
  });

  if (!limited.allowed) {
    return NextResponse.json(
      { error: "Слишком много попыток. Повторите позже." },
      { status: 429, headers: { "Retry-After": String(limited.retryAfterSeconds) } },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Неверный формат запроса" }, { status: 400 });
  }

  const raw = typeof body === "object" && body !== null ? (body as Record<string, unknown>) : {};
  const phone = asString(raw.phone);

  const chatId = getWhatsAppChatIdFromPhone(phone);
  if (!chatId) {
    return NextResponse.json({ error: "Введите корректный номер телефона" }, { status: 422 });
  }

  // Пер-таргет лимит (по номеру) помимо IP: иначе перебор кода/спам обходится сменой
  // x-forwarded-for. Ограничивает число отправок на один номер.
  const targetLimited = await checkRateLimit({
    identifier: chatId,
    limit: 3,
    namespace: "profile:login-code-target",
    windowMs: 10 * 60 * 1000,
  });

  if (!targetLimited.allowed) {
    return NextResponse.json(
      { error: "Слишком много запросов кода на этот номер. Повторите позже." },
      { status: 429, headers: { "Retry-After": String(targetLimited.retryAfterSeconds) } },
    );
  }

  const profile = await fetchWhatsAppClientByChatId(chatId).catch(() => null);

  // Аккаунта нет — как и обычный вход по паролю, отправляем на регистрацию.
  if (!profile) {
    return NextResponse.json({ notRegistered: true });
  }

  const code = generateOtpCode();
  const sent = await sendGreenApiTextMessage(chatId, formatOtpMessage(code));

  if (!sent) {
    return NextResponse.json(
      { error: "Не удалось отправить код в WhatsApp. Попробуйте позже." },
      { status: 502 },
    );
  }

  const challenge = await signOtpChallenge({
    purpose: "login",
    email: profile.customerEmail?.trim().toLowerCase() ?? "",
    phone: profile.customerPhone ?? phone,
    chatId,
    companyName: profile.companyName ?? "",
    userId: "",
    codeHash: await hashOtpCode(code),
    exp: Date.now() + OTP_TTL_MS,
  });

  const response = NextResponse.json({ ok: true, needsOtp: true });
  response.cookies.set(OTP_CHALLENGE_COOKIE, challenge, {
    httpOnly: true,
    maxAge: OTP_COOKIE_MAX_AGE_S,
    path: "/",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });

  return response;
}
