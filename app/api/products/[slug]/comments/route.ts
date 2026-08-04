import { NextResponse, type NextRequest } from "next/server";
import { CLIENT_SESSION_COOKIE, verifyClientSession } from "@/src/lib/client-session";
import { checkRateLimit, getRequestIdentifier } from "@/src/lib/rate-limit";
import { fetchPublishedComments, insertComment } from "@/src/lib/comments/store";

type Ctx = { params: Promise<{ slug: string }> };

const MIN_LEN = 2;
const MAX_LEN = 1000;

/** Убираем управляющие символы, кроме таба (9), перевода строки (10) и возврата (13). */
function stripControlChars(value: string): string {
  let out = "";
  for (const ch of value) {
    const code = ch.codePointAt(0) ?? 0;
    if (code >= 32 || code === 9 || code === 10 || code === 13) out += ch;
  }
  return out;
}

export async function GET(_request: NextRequest, { params }: Ctx) {
  const { slug } = await params;
  const comments = await fetchPublishedComments(slug);
  return NextResponse.json({ comments });
}

export async function POST(request: NextRequest, { params }: Ctx) {
  const { slug } = await params;

  const limited = await checkRateLimit({
    identifier: getRequestIdentifier(request),
    limit: 5,
    namespace: "product:comment",
    windowMs: 10 * 60 * 1000,
  });
  if (!limited.allowed) {
    return NextResponse.json(
      { error: "Слишком много комментариев. Повторите позже." },
      { status: 429, headers: { "Retry-After": String(limited.retryAfterSeconds) } },
    );
  }

  // Только залогиненный клиент; личность (имя/телефон/почта) берём из СЕССИИ, не из тела.
  const session = await verifyClientSession(request.cookies.get(CLIENT_SESSION_COOKIE)?.value ?? "");
  if (!session) {
    return NextResponse.json({ error: "Войдите, чтобы оставить комментарий" }, { status: 401 });
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Неверный формат запроса" }, { status: 400 });
  }

  const raw = typeof payload === "object" && payload !== null ? (payload as Record<string, unknown>) : {};
  const body = stripControlChars(typeof raw.body === "string" ? raw.body : "").trim();

  if (body.length < MIN_LEN || body.length > MAX_LEN) {
    return NextResponse.json(
      { error: `Комментарий должен быть от ${MIN_LEN} до ${MAX_LEN} символов` },
      { status: 422 },
    );
  }

  const authorName = session.companyName?.trim() || "Клиент";
  const ok = await insertComment({
    productSlug: slug,
    authorName,
    authorPhone: session.phone || null,
    authorEmail: session.email || null,
    body,
  });

  if (!ok) {
    return NextResponse.json({ error: "Не удалось сохранить комментарий" }, { status: 500 });
  }

  // Премодерация: комментарий появится после проверки менеджером.
  return NextResponse.json({ ok: true, pending: true });
}
