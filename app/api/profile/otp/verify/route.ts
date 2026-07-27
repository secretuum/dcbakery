import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { checkRateLimit, getRequestIdentifier } from "@/src/lib/rate-limit";
import {
  isOtpExpired,
  readOtpChallenge,
  verifyOtpCode,
  OTP_CHALLENGE_COOKIE,
} from "@/src/lib/otp";
import { confirmClientEmailById } from "@/src/lib/client-auth-admin";
import {
  signClientSession,
  CLIENT_SESSION_COOKIE,
  SESSION_MAX_AGE_S,
  type ClientSessionPayload,
} from "@/src/lib/client-session";

// Проверка WhatsApp-кода при регистрации. При успехе: авто-подтверждаем email в
// Supabase (WhatsApp = доверенный канал), выдаём клиентскую сессию, гасим challenge.
export async function POST(request: Request) {
  const limited = await checkRateLimit({
    identifier: getRequestIdentifier(request),
    limit: 10,
    namespace: "profile:otp-verify",
    windowMs: 10 * 60 * 1000,
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

  const code = typeof (body as Record<string, unknown>)?.code === "string"
    ? ((body as Record<string, unknown>).code as string).trim()
    : "";

  const challenge = await readOtpChallenge((await cookies()).get(OTP_CHALLENGE_COOKIE)?.value);

  if (!challenge) {
    return NextResponse.json(
      { error: "Код не запрашивался или устарел. Запросите новый." },
      { status: 400 },
    );
  }

  if (isOtpExpired(challenge)) {
    return NextResponse.json({ error: "Код истёк. Запросите новый." }, { status: 400 });
  }

  if (!(await verifyOtpCode(challenge, code))) {
    return NextResponse.json({ error: "Неверный код" }, { status: 401 });
  }

  // Успех. Авто-подтверждаем email (best-effort — не роняем вход, если не вышло).
  if (challenge.userId) {
    await confirmClientEmailById(challenge.userId).catch(() => false);
  }

  const payload: ClientSessionPayload = {
    email: challenge.email,
    phone: challenge.phone,
    companyName: challenge.companyName,
    accountantPhone: "",
    exp: Date.now() + SESSION_MAX_AGE_S * 1000,
  };

  const signed = await signClientSession(payload);
  const response = NextResponse.json({
    ok: true,
    email: challenge.email,
    phone: challenge.phone,
    companyName: challenge.companyName,
  });

  response.cookies.set(CLIENT_SESSION_COOKIE, signed, {
    httpOnly: true,
    maxAge: SESSION_MAX_AGE_S,
    path: "/",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });
  // Гасим challenge — код одноразовый.
  response.cookies.set(OTP_CHALLENGE_COOKIE, "", { httpOnly: true, maxAge: 0, path: "/" });

  return response;
}
