import "server-only";

export type AdminIdentity = {
  app_metadata?: {
    role?: string;
  };
  email?: string;
};

/** Роль в админке: "admin" — полный доступ; "manager" — торгпред (ограничен, гейтит proxy). */
export type AdminRole = "admin" | "manager";

function getEmailSet(envValue: string | undefined): Set<string> {
  return new Set(
    (envValue ?? "")
      .split(",")
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean),
  );
}

/**
 * Роль текущего идентити или null (не сотрудник).
 * Источник роли — Supabase `app_metadata.role` (пользователь сам её не меняет) ИЛИ
 * env-списки ADMIN_EMAILS / MANAGER_EMAILS (быстрое назначение без дашборда).
 * ⚠️ Роль в app_metadata, НЕ user_metadata — иначе клиент выпишет её себе сам.
 */
export function getAdminRole(user: AdminIdentity | null | undefined): AdminRole | null {
  if (!user) {
    return null;
  }

  const email = user.email?.trim().toLowerCase();
  const metaRole = user.app_metadata?.role;

  // Полный админ.
  if (metaRole === "admin") {
    return "admin";
  }
  if (email && getEmailSet(process.env.ADMIN_EMAILS).has(email)) {
    return "admin";
  }

  // Торговый представитель (менеджер) — видит всё, но опасные операции блокирует proxy.
  if (metaRole === "manager") {
    return "manager";
  }
  if (email && getEmailSet(process.env.MANAGER_EMAILS).has(email)) {
    return "manager";
  }

  return null;
}

/**
 * true, если это сотрудник с доступом в админку (админ ИЛИ торгпред). Разграничение
 * прав между ними — в proxy.ts (мутации в админке доступны только полному админу).
 * Backward compatibility: без ADMIN_EMAILS/MANAGER_EMAILS и без app_metadata.role — доступа нет.
 */
export function isAdminIdentity(user: AdminIdentity | null | undefined) {
  return getAdminRole(user) !== null;
}
