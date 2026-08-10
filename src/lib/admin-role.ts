// Чистая (без server-only, без next) логика ролей админки — вынесена ради тестов.
// Обёртка, читающая env и cookie, — в admin-access.ts / superadmin.ts.

export type AdminIdentity = {
  app_metadata?: {
    role?: string;
  };
  email?: string;
};

/** Роль в админке: "admin" — полный доступ; "manager" — торгпред (ограничен, гейтит proxy). */
export type AdminRole = "admin" | "manager";

/** env-строка "a@x, b@y" → множество нормализованных email. */
export function parseEmailSet(envValue: string | undefined): Set<string> {
  return new Set(
    (envValue ?? "")
      .split(",")
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean),
  );
}

/**
 * Роль идентити (чистая: email-списки передаются параметрами). admin приоритетнее
 * manager. Источник роли — `app_metadata.role` ИЛИ email-списки ADMIN/MANAGER.
 */
export function resolveAdminRole(
  user: AdminIdentity | null | undefined,
  adminEmails: Set<string>,
  managerEmails: Set<string>,
): AdminRole | null {
  if (!user) {
    return null;
  }

  const email = user.email?.trim().toLowerCase();
  const metaRole = user.app_metadata?.role;

  if (metaRole === "admin") {
    return "admin";
  }
  if (email && adminEmails.has(email)) {
    return "admin";
  }
  if (metaRole === "manager") {
    return "manager";
  }
  if (email && managerEmails.has(email)) {
    return "manager";
  }

  return null;
}

/**
 * Разрешена ли торгпреду (роль manager) эта операция в админке.
 * Чтение (GET/HEAD/OPTIONS) — всегда. Мутации — только если путь ТОЧНО в белом
 * списке (НЕ префикс: иначе "/api/admin/clients" открыл бы "/api/admin/clients/credit").
 */
export function isManagerMutationAllowed(
  method: string,
  pathname: string,
  allowlist: readonly string[],
): boolean {
  if (["GET", "HEAD", "OPTIONS"].includes(method.toUpperCase())) {
    return true;
  }
  return allowlist.includes(pathname);
}
