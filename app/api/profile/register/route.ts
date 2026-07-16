import { NextResponse } from "next/server";
import { checkRateLimit, getRequestIdentifier } from "@/src/lib/rate-limit";
import { fetchWhatsAppClientByEmail } from "@/src/lib/magic-link-store";
import { getWhatsAppChatIdFromPhone } from "@/src/lib/whatsapp";
import {
  fetchWhatsAppClientByChatId,
  saveWhatsAppClientProfile,
} from "@/src/lib/whatsapp-client-store";
import { signUpClientAuthUser } from "@/src/lib/client-auth";
import {
  signClientSession,
  CLIENT_SESSION_COOKIE,
  SESSION_MAX_AGE_S,
  type ClientSessionPayload,
} from "@/src/lib/client-session";

const EMAIL_RE = /^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$/;
const MIN_PASSWORD_LENGTH = 8;

function asString(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

export async function POST(request: Request) {
  const limited = await checkRateLimit({
    identifier: getRequestIdentifier(request),
    limit: 4,
    namespace: "profile:register",
    windowMs: 30 * 60 * 1000,
  });

  if (!limited.allowed) {
    return NextResponse.json(
      { error: "Слишком много попыток. Повторите через 30 минут." },
      {
        status: 429,
        headers: { "Retry-After": String(limited.retryAfterSeconds) },
      },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Неверный формат запроса" }, { status: 400 });
  }

  const raw = typeof body === "object" && body !== null ? (body as Record<string, unknown>) : {};
  const email = asString(raw.email).toLowerCase();
  const phone = asString(raw.phone);
  const password = asString(raw.password);
  const companyName = asString(raw.companyName);
  const customerBin = asString(raw.customerBin);
  const customerName = asString(raw.customerName);

  if (!EMAIL_RE.test(email)) {
    return NextResponse.json({ error: "Введите корректный email" }, { status: 422 });
  }

  const phoneDigits = phone.replace(/\D/g, "");
  if (phoneDigits.length < 11) {
    return NextResponse.json({ error: "Введите полный номер телефона" }, { status: 422 });
  }

  const chatId = getWhatsAppChatIdFromPhone(phone);
  if (!chatId) {
    return NextResponse.json({ error: "Неверный номер телефона" }, { status: 422 });
  }

  if (password.length < MIN_PASSWORD_LENGTH) {
    return NextResponse.json(
      { error: `Пароль должен быть не короче ${MIN_PASSWORD_LENGTH} символов` },
      { status: 422 },
    );
  }

  if (!companyName) {
    return NextResponse.json({ error: "Укажите название компании" }, { status: 422 });
  }

  const binDigits = customerBin.replace(/\D/g, "");
  if (binDigits.length !== 12) {
    return NextResponse.json({ error: "БИН/ИИН — 12 цифр" }, { status: 422 });
  }

  // Почта не должна быть привязана к другому номеру
  const emailOwner = await fetchWhatsAppClientByEmail(email).catch(() => null);
  if (emailOwner && emailOwner.chat_id !== chatId) {
    return NextResponse.json(
      { error: "Этот email уже привязан к другому номеру" },
      { status: 422 },
    );
  }

  // Номер не должен быть привязан к другой почте
  const existingProfile = await fetchWhatsAppClientByChatId(chatId).catch(() => null);
  const storedEmail = existingProfile?.customerEmail?.trim().toLowerCase() ?? "";
  if (EMAIL_RE.test(storedEmail) && storedEmail !== email) {
    return NextResponse.json(
      { error: "Этот номер уже привязан к другой почте. Войдите или обратитесь к менеджеру." },
      { status: 422 },
    );
  }

  const siteUrl = (
    process.env.NEXT_PUBLIC_SITE_URL ??
    `https://${request.headers.get("host") ?? "localhost:3000"}`
  ).replace(/\/$/, "");

  const created = await signUpClientAuthUser(email, password, `${siteUrl}/profile`);

  if (created === "unavailable") {
    return NextResponse.json(
      { error: "Сервис регистрации недоступен. Попробуйте позже." },
      { status: 503 },
    );
  }

  if (created === "already_exists") {
    return NextResponse.json(
      { error: "Аккаунт с этой почтой уже существует — войдите с паролем" },
      { status: 409 },
    );
  }

  try {
    await saveWhatsAppClientProfile({
      chatId,
      customerEmail: email,
      customerPhone: phone,
      companyName,
      customerBin,
      customerName: customerName || undefined,
    });
  } catch {
    return NextResponse.json(
      { error: "Не удалось сохранить профиль. Попробуйте позже." },
      { status: 500 },
    );
  }

  // Почта требует подтверждения — в кабинет пустим после клика по ссылке из письма
  if (created === "created_unconfirmed") {
    return NextResponse.json({ ok: true, needsEmailConfirm: true, email });
  }

  // Подтверждение выключено в Supabase — сразу пропускаем в личный кабинет
  const payload: ClientSessionPayload = {
    email,
    phone,
    companyName,
    accountantPhone: "",
    exp: Date.now() + SESSION_MAX_AGE_S * 1000,
  };

  const signed = await signClientSession(payload);
  const response = NextResponse.json({
    ok: true,
    email,
    phone,
    companyName,
  });

  response.cookies.set(CLIENT_SESSION_COOKIE, signed, {
    httpOnly: true,
    maxAge: SESSION_MAX_AGE_S,
    path: "/",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });

  return response;
}
