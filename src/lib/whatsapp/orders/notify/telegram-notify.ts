import "server-only";
// Короткое текстовое уведомление менеджерам в СУЩЕСТВУЮЩИЙ Telegram-чат (для
// handoff/лида). Второй канал не создаём — тот же бот и та же группа, что для заказов.
// Best-effort: ошибки не роняют поток.

const TELEGRAM_API = "https://api.telegram.org";

export async function notifyManagersText(text: string): Promise<void> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_GROUP_CHAT_ID ?? process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) return;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    await fetch(`${TELEGRAM_API}/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text, disable_web_page_preview: true }),
      signal: controller.signal,
      cache: "no-store",
    });
  } catch {
    // best-effort
  } finally {
    clearTimeout(timer);
  }
}
