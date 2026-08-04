import { NextResponse } from "next/server";
import { checkRateLimit, getRequestIdentifier } from "@/src/lib/rate-limit";
import { isValidKzMobile } from "@/src/lib/phone";
import {
  checkWhatsappExists,
  getWhatsAppChatIdFromPhone,
  sendGreenApiTextMessage,
} from "@/src/lib/whatsapp";
import {
  fetchWhatsAppClientByChatId,
  saveWhatsAppClientProfile,
} from "@/src/lib/whatsapp-client-store";
import {
  formatOtpMessage,
  generateOtpCode,
  hashOtpCode,
  signOtpChallenge,
  OTP_CHALLENGE_COOKIE,
  OTP_COOKIE_MAX_AGE_S,
  OTP_TTL_MS,
} from "@/src/lib/otp";
import { ensureClientRecord } from "@/src/lib/account/ensure-client";

// Лёгкая регистрация по телефону: номер + название компании + WhatsApp-код.
// Без email/пароля. Создаёт «облегчённый» аккаунт (профиль whatsapp_clients +
// строка clients с credit_limit=0 ⇒ обязательная предоплата). Подтверждение кода
// и выдача сессии — общий /api/profile/otp/verify (purpose "register"). Полный
// аккаунт (email+пароль) остаётся отдельным роутом /api/profile/register.

function asString(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

export async function POST(request: Request) {
  const limited = await checkRateLimit({
    identifier: getRequestIdentifier(request),
    limit: 4,
    namespace: "profile:register-lite",
    windowMs: 30 * 60 * 1000,
  });

  if (!limited.allowed) {
    return NextResponse.json(
      { error: "Слишком много попыток. Повторите через 30 минут." },
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
  const companyName = asString(raw.companyName);
  const customerName = asString(raw.customerName);

  if (!isValidKzMobile(phone)) {
    return NextResponse.json(
      { error: "Введите корректный мобильный номер, например +7 705 123 45 67" },
      { status: 422 },
    );
  }

  const chatId = getWhatsAppChatIdFromPhone(phone);
  if (!chatId) {
    return NextResponse.json({ error: "Неверный номер телефона" }, { status: 422 });
  }

  if (!companyName) {
    return NextResponse.json({ error: "Укажите название компании" }, { status: 422 });
  }

  // Номер должен быть в WhatsApp — туда уходят код, счёт и документы.
  const waExists = await checkWhatsappExists(phone);
  if (waExists === false) {
    return NextResponse.json(
      {
        error:
          "На этом номере нет WhatsApp. Счёт и документы приходят в WhatsApp — укажите номер с WhatsApp.",
      },
      { status: 422 },
    );
  }

  // Если на номере уже есть аккаунт с почтой (полная регистрация) — не перетираем
  // его лёгкой, а просим войти.
  const existingProfile = await fetchWhatsAppClientByChatId(chatId).catch(() => null);
  if (existingProfile?.customerEmail?.trim()) {
    return NextResponse.json(
      { error: "На этот номер уже есть аккаунт. Войдите по коду из WhatsApp или паролем." },
      { status: 409 },
    );
  }

  try {
    await saveWhatsAppClientProfile({
      chatId,
      customerPhone: phone,
      companyName,
      customerName: customerName || undefined,
    });
  } catch {
    return NextResponse.json(
      { error: "Не удалось сохранить профиль. Попробуйте позже." },
      { status: 500 },
    );
  }

  // Биллинг-строка clients (credit_limit=0 ⇒ предоплата). Best-effort.
  await ensureClientRecord({ phone, companyName }).catch(() => null);

  const otpCode = generateOtpCode();
  const otpSent = await sendGreenApiTextMessage(chatId, formatOtpMessage(otpCode));

  if (!otpSent) {
    return NextResponse.json(
      { error: "Не удалось отправить код в WhatsApp. Попробуйте позже." },
      { status: 502 },
    );
  }

  const challenge = await signOtpChallenge({
    purpose: "register",
    email: "",
    phone,
    chatId,
    companyName,
    userId: "",
    codeHash: await hashOtpCode(otpCode),
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
