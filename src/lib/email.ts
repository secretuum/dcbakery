import "server-only";
// Транзакционный email через Resend HTTP API. Env-gated: без RESEND_API_KEY — no-op
// (только лог), поведение не меняется. Best-effort: не бросает исключений.
// Ключ и отправитель — из env (RESEND_API_KEY, EMAIL_FROM). Домен подтверждается в Resend.

const FROM = process.env.EMAIL_FROM ?? "DC Bakery <noreply@dc-bakery.kz>";
const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

export async function sendEmail(input: { to: string; subject: string; html: string }): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.warn("[email] RESEND_API_KEY not set — пропускаю письмо:", input.subject);
    return false;
  }
  if (!input.to || !EMAIL_RE.test(input.to)) {
    return false;
  }
  // Таймаут: письмо отправляется в awaited-пути создания заказа — зависший Resend
  // не должен тормозить ответ клиенту.
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: FROM, to: input.to, subject: input.subject, html: input.html }),
      signal: controller.signal,
    });
    if (!res.ok) {
      console.error("[email] Resend вернул", res.status, await res.text().catch(() => ""));
      return false;
    }
    return true;
  } catch (error) {
    console.error("[email] ошибка отправки:", error instanceof Error ? error.message : "unknown");
    return false;
  } finally {
    clearTimeout(timer);
  }
}
