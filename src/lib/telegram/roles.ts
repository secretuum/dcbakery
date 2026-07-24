import "server-only";

// Роли Telegram-бота определяются списками числовых Telegram user ID в env
// (через запятую). Доступ есть только у тех, кто добавлен. @username не
// используем — он меняется и подделывается; сверяем по числовому id.

export type BotRole = "admin" | "manager" | "accountant";

export const roleLabels: Record<BotRole, string> = {
  admin: "Администратор",
  manager: "Менеджер",
  accountant: "Бухгалтер",
};

function parseIds(raw: string | undefined): Set<string> {
  return new Set(
    (raw ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
  );
}

/** Роль пользователя по его Telegram id, либо null — доступа нет. */
export function getRole(telegramId: number | string): BotRole | null {
  const id = String(telegramId);
  if (parseIds(process.env.TELEGRAM_ADMIN_IDS).has(id)) return "admin";
  if (parseIds(process.env.TELEGRAM_MANAGER_IDS).has(id)) return "manager";
  if (parseIds(process.env.TELEGRAM_ACCOUNTANT_IDS).has(id)) return "accountant";
  return null;
}

/** Все Telegram id для роли (для рассылки в ЛС, например реквизиты бухгалтерам). */
export function idsForRole(role: BotRole): string[] {
  const raw =
    role === "admin"
      ? process.env.TELEGRAM_ADMIN_IDS
      : role === "manager"
        ? process.env.TELEGRAM_MANAGER_IDS
        : process.env.TELEGRAM_ACCOUNTANT_IDS;
  return [...parseIds(raw)];
}

// Матрица прав по действиям заявки. Менеджер ведёт заказ, но не отмечает оплату;
// бухгалтер только отмечает/снимает оплату; админ может всё.
const PERMISSIONS: Record<BotRole, ReadonlySet<string>> = {
  admin: new Set(["confirm", "reject", "cancel", "paid", "unpaid", "work", "deliver", "done"]),
  manager: new Set(["confirm", "reject", "cancel", "work", "deliver", "done"]),
  accountant: new Set(["paid", "unpaid"]),
};

export function canDo(role: BotRole, action: string): boolean {
  return PERMISSIONS[role].has(action);
}
