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
