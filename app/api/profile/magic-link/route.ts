import { NextResponse } from "next/server";
import { checkRateLimit, getRequestIdentifier } from "@/src/lib/rate-limit";
import { createMagicLinkToken, fetchWhatsAppClientByEmail } from "@/src/lib/magic-link-store";
import { sendGreenApiTextMessage, getWhatsAppChatIdFromPhone } from "@/src/lib/whatsapp";
import { saveWhatsAppClientProfile } from "@/src/lib/whatsapp-client-store";

const EMAIL_RE = /^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$/;
const TOKEN_TTL_MS = 15 * 60 * 1000;

function asString(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

export async function POST(request: Request) {
  const limited = await checkRateLimit({
    identifier: getRequestIdentifier(request),
    limit: 4,
    namespace: "profile:magic-link",
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
  const companyName = asString(raw.companyName);

  if (!EMAIL_RE.test(email)) {
    return NextResponse.json({ error: "Введите корректный email" }, { status: 400 });
  }

  // Look up existing client by email
  const existingClient = await fetchWhatsAppClientByEmail(email).catch(() => null);
  let chatId: string | null = existingClient?.chat_id ?? null;

  if (!chatId) {
    // New client — need phone to register
    if (!phone) {
      // Tell the UI to show the registration form
      return NextResponse.json({ needsRegistration: true });
    }

    const phoneDigits = phone.replace(/\D/g, "");
    if (phoneDigits.length < 11) {
      return NextResponse.json(
        { error: "Введите корректный номер телефона" },
        { status: 422 },
      );
    }

    chatId = getWhatsAppChatIdFromPhone(phone);
    if (!chatId) {
      return NextResponse.json({ error: "Неверный номер телефона" }, { status: 422 });
    }

    // Create a free-client record in whatsapp_clients
    try {
      await saveWhatsAppClientProfile({
        chatId,
        customerEmail: email,
        customerPhone: phone,
        companyName: companyName || null,
      });
    } catch {
      return NextResponse.json(
        { error: "Не удалось создать аккаунт. Попробуйте позже." },
        { status: 500 },
      );
    }
  }

  // Generate 32-byte cryptographically secure token
  const tokenBytes = new Uint8Array(32);
  crypto.getRandomValues(tokenBytes);
  const token = Array.from(tokenBytes, (b) => b.toString(16).padStart(2, "0")).join("");
  const expiresAt = new Date(Date.now() + TOKEN_TTL_MS);

  try {
    await createMagicLinkToken({ email, token, expiresAt });
  } catch {
    return NextResponse.json({ error: "Ошибка сервера. Попробуйте позже." }, { status: 500 });
  }

  const siteUrl = (
    process.env.NEXT_PUBLIC_SITE_URL ??
    `https://${request.headers.get("host") ?? "localhost:3000"}`
  ).replace(/\/$/, "");
  const magicLink = `${siteUrl}/api/profile/verify?token=${token}`;

  const message = [
    "Вход в личный кабинет DC Bakery",
    "",
    "Ваша ссылка для входа:",
    magicLink,
    "",
    "Ссылка действует 15 минут.",
    "Если вы не запрашивали вход — проигнорируйте это сообщение.",
  ].join("\n");

  await sendGreenApiTextMessage(chatId, message).catch(() => null);

  return NextResponse.json({ sent: true });
}
