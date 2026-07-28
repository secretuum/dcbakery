import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { checkRateLimit, getRequestIdentifier } from "@/src/lib/rate-limit";
import { isOtpExpired, readOtpChallenge, verifyOtpCode, OTP_CHALLENGE_COOKIE } from "@/src/lib/otp";
import {
  signClientSession,
  verifyClientSession,
  CLIENT_SESSION_COOKIE,
  SESSION_MAX_AGE_S,
  type ClientSessionPayload,
} from "@/src/lib/client-session";

// Проверка кода подтверждения номера. При успехе перевыпускаем сессию с
// phoneVerified=true (чтобы плашка в кабинете погасла).
export async function POST(request: Request) {
  const limited = await checkRateLimit({
    identifier: getRequestIdentifier(request),
    limit: 10,
    namespace: "profile:verify-phone-confirm",
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

  const jar = await cookies();
  const session = await verifyClientSession(jar.get(CLIENT_SESSION_COOKIE)?.value ?? "");

  if (!session) {
    return NextResponse.json({ error: "Требуется вход" }, { status: 401 });
  }

  const challenge = await readOtpChallenge(jar.get(OTP_CHALLENGE_COOKIE)?.value, "verify_phone");

  if (!challenge || isOtpExpired(challenge)) {
    return NextResponse.json({ error: "Код не запрашивался или истёк. Запросите новый." }, { status: 400 });
  }

  // Код должен относиться к номеру текущей сессии.
  if (challenge.phone !== session.phone) {
    return NextResponse.json({ error: "Код не совпадает с номером профиля." }, { status: 400 });
  }

  if (!(await verifyOtpCode(challenge, code))) {
    return NextResponse.json({ error: "Неверный код" }, { status: 401 });
  }

  const payload: ClientSessionPayload = {
    email: session.email,
    phone: session.phone,
    companyName: session.companyName,
    accountantPhone: session.accountantPhone,
    phoneVerified: true,
    exp: Date.now() + SESSION_MAX_AGE_S * 1000,
  };

  const signed = await signClientSession(payload);
  const response = NextResponse.json({ ok: true });

  response.cookies.set(CLIENT_SESSION_COOKIE, signed, {
    httpOnly: true,
    maxAge: SESSION_MAX_AGE_S,
    path: "/",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });
  response.cookies.set(OTP_CHALLENGE_COOKIE, "", { httpOnly: true, maxAge: 0, path: "/" });

  return response;
}
