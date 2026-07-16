import { NextResponse } from "next/server";
import { checkRateLimit, getRequestIdentifier } from "@/src/lib/rate-limit";
import { requestPasswordReset } from "@/src/lib/client-auth";

const EMAIL_RE = /^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$/;

function asString(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

export async function POST(request: Request) {
  const limited = await checkRateLimit({
    identifier: getRequestIdentifier(request),
    limit: 4,
    namespace: "profile:reset-password",
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

  if (!EMAIL_RE.test(email)) {
    return NextResponse.json({ error: "Введите корректный email" }, { status: 422 });
  }

  const siteUrl = (
    process.env.NEXT_PUBLIC_SITE_URL ??
    `https://${request.headers.get("host") ?? "localhost:3000"}`
  ).replace(/\/$/, "");

  await requestPasswordReset(email, `${siteUrl}/profile/reset`);

  // Не раскрываем, существует ли почта в базе
  return NextResponse.json({ ok: true });
}
