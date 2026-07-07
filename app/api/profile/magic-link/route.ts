import { NextResponse } from "next/server";
import { checkRateLimit, getRequestIdentifier } from "@/src/lib/rate-limit";
import { createMagicLinkToken, fetchWhatsAppClientByEmail } from "@/src/lib/magic-link-store";
import { sendGreenApiTextMessage } from "@/src/lib/whatsapp";

const EMAIL_RE = /^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$/;
const TOKEN_TTL_MS = 15 * 60 * 1000;

export async function POST(request: Request) {
  const limited = checkRateLimit({
    identifier: getRequestIdentifier(request),
    limit: 2,
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

  const email =
    typeof body === "object" &&
    body !== null &&
    "email" in body &&
    typeof (body as Record<string, unknown>).email === "string"
      ? ((body as Record<string, unknown>).email as string).trim().toLowerCase()
      : "";

  if (!EMAIL_RE.test(email)) {
    return NextResponse.json({ error: "Введите корректный email" }, { status: 400 });
  }

  const client = await fetchWhatsAppClientByEmail(email).catch(() => null);

  if (!client?.chat_id) {
    return NextResponse.json(
      { error: "Для входа обратитесь к менеджеру" },
      { status: 422 },
    );
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

  const host = request.headers.get("host") ?? "localhost:3000";
  const proto = host.startsWith("localhost") || host.startsWith("127.") ? "http" : "https";
  const magicLink = `${proto}://${host}/api/profile/verify?token=${token}`;

  const message = [
    "Вход в личный кабинет DC Bakery",
    "",
    "Ваша ссылка для входа:",
    magicLink,
    "",
    "Ссылка действует 15 минут.",
    "Если вы не запрашивали вход — проигнорируйте это сообщение.",
  ].join("\n");

  await sendGreenApiTextMessage(client.chat_id, message).catch(() => null);

  return NextResponse.json({ sent: true });
}
