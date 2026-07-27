import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { checkRateLimit, getRequestIdentifier } from "@/src/lib/rate-limit";
import { sendGreenApiTextMessage } from "@/src/lib/whatsapp";
import {
  formatOtpMessage,
  generateOtpCode,
  hashOtpCode,
  readOtpChallenge,
  signOtpChallenge,
  OTP_CHALLENGE_COOKIE,
  OTP_COOKIE_MAX_AGE_S,
  OTP_TTL_MS,
} from "@/src/lib/otp";

// Повторная отправка WhatsApp-кода. Жёсткий лимит (WhatsApp-сообщения дорого/спамно)
// и только при наличии подписанного challenge — нельзя слать код на произвольный номер.
export async function POST(request: Request) {
  const limited = await checkRateLimit({
    identifier: getRequestIdentifier(request),
    limit: 3,
    namespace: "profile:otp-resend",
    windowMs: 10 * 60 * 1000,
  });

  if (!limited.allowed) {
    return NextResponse.json(
      { error: "Слишком много запросов кода. Повторите позже." },
      { status: 429, headers: { "Retry-After": String(limited.retryAfterSeconds) } },
    );
  }

  // Истёкший challenge допустим — по нему знаем, кому переслать код.
  const prev = await readOtpChallenge((await cookies()).get(OTP_CHALLENGE_COOKIE)?.value);

  if (!prev) {
    return NextResponse.json(
      { error: "Сначала заполните форму регистрации." },
      { status: 400 },
    );
  }

  const code = generateOtpCode();
  const sent = await sendGreenApiTextMessage(prev.chatId, formatOtpMessage(code));

  if (!sent) {
    return NextResponse.json(
      { error: "Не удалось отправить код. Попробуйте позже." },
      { status: 502 },
    );
  }

  const challenge = await signOtpChallenge({
    ...prev,
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
