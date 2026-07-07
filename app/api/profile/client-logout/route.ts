import { NextResponse } from "next/server";
import { CLIENT_SESSION_COOKIE } from "@/src/lib/client-session";

export async function POST() {
  const response = NextResponse.json({ ok: true });
  response.cookies.set(CLIENT_SESSION_COOKIE, "", {
    httpOnly: true,
    maxAge: 0,
    path: "/",
    sameSite: "lax",
  });
  return response;
}
