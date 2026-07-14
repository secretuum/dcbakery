import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import {
  fetchClientByEmail,
  fetchClientByPhone,
  getSupabaseAdminConfigError,
} from "@/src/lib/supabase/admin";
import { getCreditState } from "@/src/lib/credit";
import { CLIENT_SESSION_COOKIE, verifyClientSession } from "@/src/lib/client-session";

export async function GET() {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get(CLIENT_SESSION_COOKIE)?.value;
  const session = sessionCookie ? await verifyClientSession(sessionCookie) : null;

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (getSupabaseAdminConfigError()) {
    return NextResponse.json({ creditState: null, client: null });
  }

  try {
    const client = session.phone
      ? await fetchClientByPhone(session.phone)
      : session.email
        ? await fetchClientByEmail(session.email)
        : null;

    if (!client) {
      return NextResponse.json({ creditState: null, client: null });
    }

    const creditState = await getCreditState(client);
    return NextResponse.json({ creditState, client });
  } catch {
    return NextResponse.json({ creditState: null, client: null });
  }
}
