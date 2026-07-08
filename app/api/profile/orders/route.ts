import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import {
  fetchClientOrderSummaries,
  getSupabaseAdminConfigError,
} from "@/src/lib/supabase/admin";
import { checkRateLimit, getRequestIdentifier } from "@/src/lib/rate-limit";
import { CLIENT_SESSION_COOKIE, verifyClientSession } from "@/src/lib/client-session";

const EMAIL_RE = /^[^,()[\]\s]+@[^,()[\]\s]+\.[^,()[\]\s]+$/;
const PHONE_RE = /^\+?\d{10,15}$/;

export async function POST(request: Request) {
  const rateLimit = checkRateLimit({
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

  if (session.email && !EMAIL_RE.test(session.email)) {
    return NextResponse.json({ error: "Bad Request" }, { status: 400 });
  }

  if (session.phone && !PHONE_RE.test(session.phone)) {
    return NextResponse.json({ error: "Bad Request" }, { status: 400 });
  }

  const supabaseConfigError = getSupabaseAdminConfigError();

  if (supabaseConfigError) {
    return NextResponse.json({ error: supabaseConfigError }, { status: 503 });
  }

  try {
    const orders = await fetchClientOrderSummaries({
      email: session.email,
      phone: session.phone,
    });

    return NextResponse.json({ orders });
  } catch {
    return NextResponse.json({ error: "Failed to load orders" }, { status: 500 });
  }
}
