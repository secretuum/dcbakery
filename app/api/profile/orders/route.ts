import { NextResponse } from "next/server";
import {
  fetchClientOrderSummaries,
  getSupabaseAdminConfigError,
} from "@/src/lib/supabase/admin";
import { checkRateLimit, getRequestIdentifier } from "@/src/lib/rate-limit";

type ProfileOrdersBody = {
  email?: string;
  phone?: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function asString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}

const EMAIL_RE = /^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$/;

function isValidEmail(value: string): boolean {
  return EMAIL_RE.test(value);
}

function isValidPhone(value: string): boolean {
  // Reject anything that isn't a digit or common phone separator (+, -, space, parens)
  if (!/^[0-9+\-() ]+$/.test(value)) return false;
  return value.replace(/\D/g, "").length >= 10;
}

async function parseBody(request: Request): Promise<ProfileOrdersBody> {
  const payload = (await request.json()) as unknown;

  if (!isRecord(payload)) {
    return {};
  }

  return {
    email: normalizeEmail(asString(payload.email)),
    phone: asString(payload.phone),
  };
}

export async function POST(request: Request) {
  const rateLimit = checkRateLimit({
    identifier: getRequestIdentifier(request),
    limit: 3,
    namespace: "profile:orders",
    windowMs: 30 * 60 * 1000,
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

  const supabaseConfigError = getSupabaseAdminConfigError();

  if (supabaseConfigError) {
    return NextResponse.json({ error: supabaseConfigError }, { status: 503 });
  }

  let body: ProfileOrdersBody;

  try {
    body = await parseBody(request);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const email = body.email && isValidEmail(body.email) ? body.email : "";
  const phone = body.phone && isValidPhone(body.phone) ? body.phone : "";

  if (!email && !phone) {
    return NextResponse.json(
      { error: "Email or phone is required to find orders" },
      { status: 400 },
    );
  }

  try {
    const orders = await fetchClientOrderSummaries({ email, phone });

    return NextResponse.json({ orders });
  } catch {
    return NextResponse.json({ error: "Failed to load orders" }, { status: 500 });
  }
}
