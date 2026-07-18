import "server-only";
import { cookies } from "next/headers";
import { ADMIN_ACCESS_COOKIE } from "@/src/lib/supabase/auth";
import { isAdminIdentity, type AdminIdentity } from "@/src/lib/admin-access";

// Email текущего админа по его access-cookie — для журнала ручных действий
// (кто отметил/снял оплату). Маршруты и так закрыты proxy.ts; здесь только identity.

export async function getAdminEmail(): Promise<string | null> {
  const token = (await cookies()).get(ADMIN_ACCESS_COOKIE)?.value;

  if (!token) {
    return null;
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !anonKey) {
    return null;
  }

  try {
    const response = await fetch(`${supabaseUrl.replace(/\/$/, "")}/auth/v1/user`, {
      headers: { apikey: anonKey, Authorization: `Bearer ${token}` },
      cache: "no-store",
    });

    if (!response.ok) {
      return null;
    }

    const identity = (await response.json()) as AdminIdentity;
    return isAdminIdentity(identity) ? identity.email?.trim().toLowerCase() ?? null : null;
  } catch {
    return null;
  }
}
