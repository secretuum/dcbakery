import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import {
  fetchClientOrderSummaries,
  getSupabaseAdminConfigError,
} from "@/src/lib/supabase/admin";
import { checkRateLimit, getRequestIdentifier } from "@/src/lib/rate-limit";
import { CLIENT_SESSION_COOKIE, verifyClientSession } from "@/src/lib/client-session";
import { normalizeKzPhone } from "@/src/lib/phone";

const EMAIL_RE = /^[^,()[\]\s]+@[^,()[\]\s]+\.[^,()[\]\s]+$/;

export async function POST(request: Request) {
  const rateLimit = await checkRateLimit({
    identifier: getRequestIdentifier(request),
    limit: 10,
    namespace: "profile:orders",
    windowMs: 15 * 60 * 1000,
  });

  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: "Too many profile lookup attempts" },
      {
        status: 429,
        headers: { "Retry-After": String(rateLimit.retryAfterSeconds) },
      },
    );
  }

  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get(CLIENT_SESSION_COOKIE)?.value;
  const session = sessionCookie ? await verifyClientSession(sessionCookie) : null;

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Телефон в сессии может быть в человекочитаемом виде («+7 705 123 45 67») —
  // нормализуем к «+7XXXXXXXXXX», чтобы пройти валидацию запроса и матчинг заказа.
  const emailForQuery = session.email && EMAIL_RE.test(session.email) ? session.email : undefined;
  const phoneDigits = session.phone ? normalizeKzPhone(session.phone) : "";
  const phoneForQuery = /^\d{10,15}$/.test(phoneDigits) ? `+${phoneDigits}` : undefined;

  // Без валидного идентификатора не запрашиваем (иначе выборка без фильтра вернёт чужие заказы).
  if (!emailForQuery && !phoneForQuery) {
    return NextResponse.json({ orders: [] });
  }

  const supabaseConfigError = getSupabaseAdminConfigError();

  if (supabaseConfigError) {
    return NextResponse.json({ error: supabaseConfigError }, { status: 503 });
  }

  try {
    const orders = await fetchClientOrderSummaries({
      email: emailForQuery,
      phone: phoneForQuery,
    });

    return NextResponse.json({ orders });
  } catch {
    return NextResponse.json({ error: "Failed to load orders" }, { status: 500 });
  }
}
