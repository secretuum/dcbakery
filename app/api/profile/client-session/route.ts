import { type NextRequest, NextResponse } from "next/server";
import { CLIENT_SESSION_COOKIE, verifyClientSession } from "@/src/lib/client-session";
import {
  fetchClientByEmail,
  fetchClientByPhone,
  getSupabaseAdminConfigError,
} from "@/src/lib/supabase/admin";
import { getAccountTier } from "@/src/lib/account/tier";
import { getWhatsAppChatIdFromPhone } from "@/src/lib/whatsapp";
import { fetchWhatsAppClientByChatId } from "@/src/lib/whatsapp-client-store";

export async function GET(request: NextRequest) {
  const cookieValue = request.cookies.get(CLIENT_SESSION_COOKIE)?.value;

  if (!cookieValue) {
    return NextResponse.json({ authenticated: false });
  }

  const session = await verifyClientSession(cookieValue);

  if (!session) {
    return NextResponse.json({ authenticated: false });
  }

  // Тир аккаунта для чекаута (нотис предоплаты + клиентский потолок). Полный, если
  // менеджер открыл кредит ИЛИ клиент дозаполнил профиль (БИН + адрес).
  let tier: "lite" | "full" = "lite";
  if (!getSupabaseAdminConfigError()) {
    try {
      const client = session.phone
        ? await fetchClientByPhone(session.phone)
        : session.email
          ? await fetchClientByEmail(session.email)
          : null;
      const chatId = session.phone ? getWhatsAppChatIdFromPhone(session.phone) : null;
      const profile = chatId ? await fetchWhatsAppClientByChatId(chatId).catch(() => null) : null;
      tier = getAccountTier({
        customerBin: profile?.customerBin,
        hasAddress: Boolean(profile?.deliveryAddress || (profile?.addresses?.length ?? 0) > 0),
        creditLimit: client?.credit_limit ?? 0,
      });
    } catch {
      tier = "lite";
    }
  }

  return NextResponse.json({
    authenticated: true,
    email: session.email,
    phone: session.phone,
    companyName: session.companyName,
    accountantPhone: session.accountantPhone,
    phoneVerified: session.phoneVerified === true,
    tier,
  });
}
