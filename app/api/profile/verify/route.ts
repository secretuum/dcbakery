import { type NextRequest, NextResponse } from "next/server";
import { consumeMagicLinkToken, fetchWhatsAppClientByEmail } from "@/src/lib/magic-link-store";
import {
  signClientSession,
  CLIENT_SESSION_COOKIE,
  SESSION_MAX_AGE_S,
  type ClientSessionPayload,
} from "@/src/lib/client-session";

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token") ?? "";

  if (!token) {
    return NextResponse.redirect(new URL("/profile", request.url));
  }

  const result = await consumeMagicLinkToken(token).catch(() => null);

  if (!result) {
    return NextResponse.redirect(new URL("/profile", request.url));
  }

  const client = await fetchWhatsAppClientByEmail(result.email).catch(() => null);

  const payload: ClientSessionPayload = {
    email: result.email,
    phone: client?.customer_phone ?? "",
    companyName: client?.company_name ?? "",
    accountantPhone: client?.accountant_phone ?? "",
    exp: Date.now() + SESSION_MAX_AGE_S * 1000,
  };

  const signed = await signClientSession(payload);

  const response = NextResponse.redirect(new URL("/profile", request.url));
  response.cookies.set(CLIENT_SESSION_COOKIE, signed, {
    httpOnly: true,
    maxAge: SESSION_MAX_AGE_S,
    path: "/",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });

  return response;
}
