import { NextResponse } from "next/server";
import {
  ADMIN_ACCESS_COOKIE,
  ADMIN_REFRESH_COOKIE,
  getSupabaseAuthConfigError,
  getSupabaseAuthUrl,
  type SupabasePasswordAuthResponse,
} from "@/src/lib/supabase/auth";

type LoginBody = {
  email?: string;
  password?: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function asString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

async function parseLoginBody(request: Request): Promise<LoginBody> {
  const payload = (await request.json()) as unknown;

  if (!isRecord(payload)) {
    return {};
  }

  return {
    email: asString(payload.email),
    password: asString(payload.password),
  };
}

function shouldUseSecureCookies(request: Request) {
  const host = request.headers.get("host") ?? "";
  const isLocalhost = host.startsWith("localhost") || host.startsWith("127.0.0.1");

  return process.env.NODE_ENV === "production" && !isLocalhost;
}

export async function POST(request: Request) {
  const configError = getSupabaseAuthConfigError();
  const authUrl = getSupabaseAuthUrl("token?grant_type=password");
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (configError || !authUrl || !anonKey) {
    return NextResponse.json({ error: configError ?? "Supabase Auth is not configured" }, { status: 503 });
  }

  let body: LoginBody;

  try {
    body = await parseLoginBody(request);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body.email || !body.password) {
    return NextResponse.json({ error: "Email and password are required" }, { status: 400 });
  }

  const authResponse = await fetch(authUrl, {
    method: "POST",
    headers: {
      apikey: anonKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      email: body.email,
      password: body.password,
    }),
  });

  if (!authResponse.ok) {
    return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });
  }

  const payload = (await authResponse.json()) as SupabasePasswordAuthResponse;

  if (!payload.access_token || !payload.refresh_token) {
    return NextResponse.json({ error: "Auth response is incomplete" }, { status: 502 });
  }

  const response = NextResponse.json({
    email: payload.user?.email ?? body.email,
    ok: true,
  });
  const secureCookies = shouldUseSecureCookies(request);

  response.cookies.set(ADMIN_ACCESS_COOKIE, payload.access_token, {
    httpOnly: true,
    maxAge: payload.expires_in ?? 3600,
    path: "/",
    sameSite: "lax",
    secure: secureCookies,
  });
  response.cookies.set(ADMIN_REFRESH_COOKIE, payload.refresh_token, {
    httpOnly: true,
    maxAge: 60 * 60 * 24 * 30,
    path: "/",
    sameSite: "lax",
    secure: secureCookies,
  });

  return response;
}
