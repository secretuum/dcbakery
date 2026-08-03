// Лёгкий репорт ошибок в Sentry БЕЗ SDK (совместимо с Next 16, без правки сборки).
// Работает и на сервере, и в браузере. Всегда пишет console.error (видно в логах Render),
// а при заданном DSN дополнительно шлёт событие в Sentry через envelope-эндпоинт.
// Best-effort: никогда не бросает исключение. DSN публичен по дизайну Sentry.

type ReportContext = {
  where?: string;
  extra?: Record<string, unknown>;
  level?: "error" | "warning" | "info";
};

function getDsn(): string | undefined {
  return process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN || undefined;
}

// DSN: https://<publicKey>@<host>/<projectId>
function parseDsn(dsn: string) {
  const m = dsn.match(/^(https?):\/\/([^@]+)@([^/]+)\/(.+)$/);
  if (!m) return null;
  return { protocol: m[1], publicKey: m[2], host: m[3], projectId: m[4] };
}

function eventId(): string {
  const uuid = globalThis.crypto?.randomUUID?.();
  return uuid ? uuid.replace(/-/g, "") : `${Date.now().toString(16)}`.padEnd(32, "0").slice(0, 32);
}

function toError(input: unknown): Error {
  if (input instanceof Error) return input;
  if (typeof input === "string") return new Error(input);
  try {
    return new Error(JSON.stringify(input));
  } catch {
    return new Error("Unknown error");
  }
}

/** Залогировать ошибку (всегда) и отправить в Sentry (если задан DSN). Никогда не бросает. */
export function reportError(input: unknown, ctx: ReportContext = {}): void {
  const err = toError(input);
  // Всегда в логи — это уже лучше «немого» catch.
  console.error(`[monitor]${ctx.where ? ` ${ctx.where}` : ""}:`, err.message, ctx.extra ?? "");

  const dsn = getDsn();
  if (!dsn) return;
  const parsed = parseDsn(dsn);
  if (!parsed) return;

  try {
    const id = eventId();
    const isServer = typeof window === "undefined";
    const event = {
      event_id: id,
      timestamp: Date.now() / 1000,
      platform: isServer ? "node" : "javascript",
      level: ctx.level ?? "error",
      environment: process.env.NODE_ENV,
      tags: { where: ctx.where ?? "app", runtime: isServer ? "server" : "client" },
      exception: {
        values: [{ type: err.name || "Error", value: (err.message || "unknown").slice(0, 1000) }],
      },
      extra: {
        ...(ctx.extra ?? {}),
        ...(err.stack ? { stack: err.stack.slice(0, 4000) } : {}),
      },
    };
    const body =
      `${JSON.stringify({ event_id: id, sent_at: new Date().toISOString() })}\n` +
      `${JSON.stringify({ type: "event" })}\n` +
      `${JSON.stringify(event)}`;
    const url = `${parsed.protocol}://${parsed.host}/api/${parsed.projectId}/envelope/?sentry_key=${parsed.publicKey}&sentry_version=7`;

    void fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/x-sentry-envelope" },
      body,
      keepalive: !isServer,
    }).catch(() => {});
  } catch {
    // best-effort: молчим, console.error уже сработал
  }
}
