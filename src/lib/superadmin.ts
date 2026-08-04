import "server-only";
import { cookies } from "next/headers";
import { ADMIN_ACCESS_COOKIE } from "@/src/lib/supabase/auth";
import { isAdminIdentity, type AdminIdentity } from "@/src/lib/admin-access";

// Доступ к редактированию контента сайта (фото, главная, настройки) прямо со
// страниц. По просьбе открыт ВСЕМ админам-менеджерам. Раньше сужался до
// SUPERADMIN_EMAILS — теперь любой авторизованный админ может редактировать.

async function fetchIdentity(token: string): Promise<AdminIdentity | null> {
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

    return (await response.json()) as AdminIdentity;
  } catch {
    return null;
  }
}

/**
 * true, если текущий запрос сделан суперадмином.
 * Для обычных посетителей (без админ-cookie) отвечает мгновенно, без запросов.
 */
export async function getIsSuperAdmin(): Promise<boolean> {
  const token = (await cookies()).get(ADMIN_ACCESS_COOKIE)?.value;

  if (!token) {
    return false;
  }

  const identity = await fetchIdentity(token);

  // Редактирование контента открыто всем админам (менеджерам).
  return Boolean(identity && isAdminIdentity(identity));
}
