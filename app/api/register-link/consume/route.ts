import { NextResponse } from "next/server";
import { checkRateLimit, getRequestIdentifier } from "@/src/lib/rate-limit";
import { consumeRegistrationToken } from "@/src/lib/whatsapp/orders/registration/reg-link";

// Гашение одноразового регистрационного токена (single-use). Вызывается формой /register
// в момент отправки — не на GET-рендере (чтобы префетч не сжёг токен).
export async function POST(request: Request) {
  const limited = await checkRateLimit({
    identifier: getRequestIdentifier(request),
    limit: 10,
    namespace: "register-link:consume",
    windowMs: 10 * 60 * 1000,
  });
  if (!limited.allowed) {
    return NextResponse.json({ ok: false, error: "Слишком много попыток" }, { status: 429 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  const rt =
    typeof body === "object" && body !== null && typeof (body as Record<string, unknown>).rt === "string"
      ? ((body as Record<string, unknown>).rt as string)
      : "";

  const result = await consumeRegistrationToken(rt, new Date().toISOString());
  if (!result) {
    return NextResponse.json({ ok: false, error: "Ссылка недействительна или уже использована" }, { status: 400 });
  }

  return NextResponse.json({ ok: true, phone: result.phone });
}
