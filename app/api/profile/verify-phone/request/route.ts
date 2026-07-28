import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { checkRateLimit, getRequestIdentifier } from "@/src/lib/rate-limit";
import { getWhatsAppChatIdFromPhone, sendGreenApiTextMessage } from "@/src/lib/whatsapp";
import {
  formatOtpMessage,
  generateOtpCode,
  hashOtpCode,
  signOtpChallenge,
  OTP_CHALLENGE_COOKIE,
  OTP_COOKIE_MAX_AGE_S,
  OTP_TTL_MS,
} from "@/src/lib/otp";
import { verifyClientSession, CLIENT_SESSION_COOKIE } from "@/src/lib/client-session";

// Отправка WhatsApp-кода залогиненному клиенту для подтверждения его номера
// (плашка «подтвердите второй способ» в кабинете).
export async function POST(request: Request) {
  const limited = await checkRateLimit({
    identifier: getRequestIdentifier(request),
    limit: 3,
    namespace: "profile:verify-phone-request",
    windowMs: 10 * 60 * 1000,
  });

  if (!limited.allowed) {
    return NextResponse.json(
      { error: "Слишком много запросов кода. Повторите позже." },
      { status: 429, headers: { "Retry-After": String(limited.retryAfterSeconds) } },
    );
  }

  const jar = await cookies();
  const session = await verifyClientSession(jar.get(CLIENT_SESSION_COOKIE)?.value ?? "");

  if (!session) {
    return NextResponse.json({ error: "Требуется вход" }, { status: 401 });
  }

  const chatId = getWhatsAppChatIdFromPhone(session.phone);
  if (!chatId) {
    return NextResponse.json({ error: "В профиле нет корректного номера WhatsApp." }, { status: 400 });
  }

  const code = generateOtpCode();
  const sent = await sendGreenApiTextMessage(chatId, formatOtpMessage(code));

  if (!sent) {
    return NextResponse.json({ error: "Не удалось отправить код. Попробуйте позже." }, { status: 502 });
  }

  const challenge = await signOtpChallenge({
    purpose: "verify_phone",
    email: session.email,
    phone: session.phone,
    chatId,
    companyName: session.companyName,
    userId: "",
    codeHash: await hashOtpCode(code),
    exp: Date.now() + OTP_TTL_MS,
  });

  const response = NextResponse.json({ ok: true });
  response.cookies.set(OTP_CHALLENGE_COOKIE, challenge, {
    httpOnly: true,
    maxAge: OTP_COOKIE_MAX_AGE_S,
    path: "/",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });

  return response;
}
