import "server-only";
import { parseEmailSet, resolveAdminRole } from "@/src/lib/admin-role";
import type { AdminIdentity, AdminRole } from "@/src/lib/admin-role";

export type { AdminIdentity, AdminRole };

/**
 * Роль текущего идентити или null (не сотрудник). Читает env ADMIN_EMAILS/MANAGER_EMAILS
 * и делегирует чистой resolveAdminRole (см. admin-role.ts, покрыта тестами).
 * ⚠️ Роль назначается через Supabase app_metadata.role (НЕ user_metadata) или env-список.
 */
export function getAdminRole(user: AdminIdentity | null | undefined): AdminRole | null {
  return resolveAdminRole(
    user,
    parseEmailSet(process.env.ADMIN_EMAILS),
    parseEmailSet(process.env.MANAGER_EMAILS),
  );
}

/**
 * true, если это сотрудник с доступом в админку (админ ИЛИ торгпред). Разграничение
 * прав между ними — в proxy.ts (мутации в админке доступны только полному админу).
 */
export function isAdminIdentity(user: AdminIdentity | null | undefined) {
  return getAdminRole(user) !== null;
}
