import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import {
  fetchClientByEmail,
  fetchClientByPhone,
  getSupabaseAdminConfigError,
} from "@/src/lib/supabase/admin";
import { getCreditState } from "@/src/lib/credit";
import { CLIENT_SESSION_COOKIE, verifyClientSession } from "@/src/lib/client-session";
import { getAccountTier } from "@/src/lib/account/tier";
import { getWhatsAppChatIdFromPhone } from "@/src/lib/whatsapp";
import { fetchWhatsAppClientByChatId } from "@/src/lib/whatsapp-client-store";

export async function GET() {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get(CLIENT_SESSION_COOKIE)?.value;
  const session = sessionCookie ? await verifyClientSession(sessionCookie) : null;

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (getSupabaseAdminConfigError()) {
    return NextResponse.json({ creditState: null, client: null, tier: "lite" });
  }

  try {
    const client = session.phone
      ? await fetchClientByPhone(session.phone)
      : session.email
        ? await fetchClientByEmail(session.email)
        : null;

    // Тир аккаунта: полный, если менеджер открыл кредит ИЛИ клиент дозаполнил профиль
    // (БИН + адрес). Данные профиля берём из whatsapp_clients.
    const chatId = session.phone ? getWhatsAppChatIdFromPhone(session.phone) : null;
    const profile = chatId ? await fetchWhatsAppClientByChatId(chatId).catch(() => null) : null;
    const tier = getAccountTier({
      customerBin: profile?.customerBin,
      hasAddress: Boolean(profile?.deliveryAddress || (profile?.addresses?.length ?? 0) > 0),
      creditLimit: client?.credit_limit ?? 0,
    });

    if (!client) {
      return NextResponse.json({ creditState: null, client: null, tier });
    }

    const creditState = await getCreditState(client);
    return NextResponse.json({ creditState, client, tier });
  } catch {
    return NextResponse.json({ creditState: null, client: null, tier: "lite" });
  }
}
