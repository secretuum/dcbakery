import { type NextRequest, NextResponse } from "next/server";
import { CLIENT_SESSION_COOKIE, verifyClientSession } from "@/src/lib/client-session";

export async function GET(request: NextRequest) {
  const cookieValue = request.cookies.get(CLIENT_SESSION_COOKIE)?.value;

  if (!cookieValue) {
    return NextResponse.json({ authenticated: false });
  }

  const session = await verifyClientSession(cookieValue);

  if (!session) {
    return NextResponse.json({ authenticated: false });
  }

  return NextResponse.json({
    authenticated: true,
    email: session.email,
    phone: session.phone,
    companyName: session.companyName,
    accountantPhone: session.accountantPhone,
  });
}
