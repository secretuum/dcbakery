import { NextResponse } from "next/server";
import { checkRateLimit, getRequestIdentifier } from "@/src/lib/rate-limit";
import { fetchWhatsAppClientByEmail } from "@/src/lib/magic-link-store";
import { getWhatsAppChatIdFromPhone } from "@/src/lib/whatsapp";
import { fetchWhatsAppClientByChatId } from "@/src/lib/whatsapp-client-store";
import { verifyClientPassword } from "@/src/lib/client-auth";
import {
  signClientSession,
  CLIENT_SESSION_COOKIE,
  SESSION_MAX_AGE_S,
  type ClientSessionPayload,
} from "@/src/lib/client-session";

function asString(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

export async function POST(request: Request) {
  const limited = await checkRateLimit({
    identifier: getRequestIdentifier(request),
    limit: 8,
    namespace: "profile:login",
    windowMs: 15 * 60 * 1000,
  });

  if (!limited.allowed) {
    return NextResponse.json(
      { error: "Слишком много попыток. Повторите через 15 минут." },
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
  const login = asString(raw.login);
  const password = asString(raw.password);

  if (!login || !password) {
    return NextResponse.json({ error: "Введите логин и пароль" }, { status: 400 });
  }

  // Логин — почта или номер телефона; в обоих случаях выходим на профиль клиента
  let email = "";
  let profile = null;

  if (login.includes("@")) {
    email = login.toLowerCase();
    const row = await fetchWhatsAppClientByEmail(email).catch(() => null);
    profile = row ? await fetchWhatsAppClientByChatId(row.chat_id).catch(() => null) : null;
  } else {
    const phoneDigits = login.replace(/\D/g, "");

    if (phoneDigits.length < 11) {
      return NextResponse.json(
        { error: "Введите почту или полный номер телефона" },
        { status: 422 },
      );
    }

    const chatId = getWhatsAppChatIdFromPhone(login);
    profile = chatId ? await fetchWhatsAppClientByChatId(chatId).catch(() => null) : null;
    email = profile?.customerEmail?.trim().toLowerCase() ?? "";
  }

  // Аккаунта нет в базе — не пропускаем и отправляем на регистрацию
  if (!profile || !email) {
    return NextResponse.json({ notRegistered: true });
  }

  const check = await verifyClientPassword(email, password);

  if (check === "unavailable") {
    return NextResponse.json({ error: "Сервис входа недоступен. Попробуйте позже." }, { status: 503 });
  }

  if (check === "unconfirmed") {
    return NextResponse.json(
      { error: "Почта не подтверждена. Откройте письмо со ссылкой подтверждения и попробуйте снова." },
      { status: 403 },
    );
  }

  if (check === "invalid") {
    return NextResponse.json(
      { error: "Неверный логин или пароль. Если вы ещё не создавали пароль — зарегистрируйтесь." },
      { status: 401 },
    );
  }

  const payload: ClientSessionPayload = {
    email,
    phone: profile.customerPhone ?? "",
    companyName: profile.companyName ?? "",
    accountantPhone: profile.accountantPhone ?? "",
    exp: Date.now() + SESSION_MAX_AGE_S * 1000,
  };

  const signed = await signClientSession(payload);
  const response = NextResponse.json({
    ok: true,
    email,
    phone: payload.phone,
    companyName: payload.companyName,
    accountantPhone: payload.accountantPhone,
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
