import "server-only";

// Журнал действий (кто / что / когда / по какой заявке) в таблице bot_audit_log.
// Пишем через Supabase REST сервисным ключом. Best-effort: журнал не должен
// ронять основной поток, поэтому все ошибки глотаем.

export type AuditEntry = {
  source?: "telegram" | "web" | "cron";
  actorTelegramId?: number | string | null;
  actorRole?: string | null;
  actorName?: string | null;
  action: string;
  orderId?: string | null;
  orderNumber?: string | null;
  details?: Record<string, unknown> | null;
};

export async function logAction(entry: AuditEntry): Promise<void> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, "");
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return;

  try {
    await fetch(`${url}/rest/v1/bot_audit_log`, {
      method: "POST",
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
        Prefer: "return=minimal",
      },
      body: JSON.stringify({
        source: entry.source ?? "telegram",
        actor_telegram_id:
          entry.actorTelegramId != null ? Number(entry.actorTelegramId) : null,
        actor_role: entry.actorRole ?? null,
        actor_name: entry.actorName ?? null,
        action: entry.action,
        order_id: entry.orderId ?? null,
        order_number: entry.orderNumber ?? null,
        details: entry.details ?? null,
      }),
    });
  } catch {
    // журнал не критичен — не роняем поток
  }
}
