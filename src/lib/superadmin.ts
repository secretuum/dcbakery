import "server-only";
import { cookies } from "next/headers";
import { ADMIN_ACCESS_COOKIE } from "@/src/lib/supabase/auth";
import { isAdminIdentity, type AdminIdentity } from "@/src/lib/admin-access";

// Доступ к редактированию контента сайта (фото, главная, настройки) прямо со страниц.
// Ограничен списком SUPERADMIN_EMAILS: обычные админы (напр. торговые представители,
// которые оформляют заявки) в него НЕ входят и правку сайта не получают. Пустой/незаданный
// список = все админы (обратная совместимость, чтобы не заблокировать себя до настройки env).

function getSuperAdminEmails(): Set<string> {
  return new Set(
    (process.env.SUPERADMIN_EMAILS ?? "")
      .split(",")
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean),
  );
}

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
  if (!identity || !isAdminIdentity(identity)) {
    return false;
  }

  // Правку сайта получают только суперадмины из SUPERADMIN_EMAILS. Пустой список = все
  // админы (обратная совместимость). Задайте SUPERADMIN_EMAILS=ваш@email, чтобы новые
  // админы-торгпреды имели доступ к админке/заявкам, но НЕ к редактированию контента.
  const superAdmins = getSuperAdminEmails();
  if (superAdmins.size === 0) {
    return true;
  }
  const email = identity.email?.trim().toLowerCase();
  return Boolean(email && superAdmins.has(email));
}
