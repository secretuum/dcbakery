import "server-only";

// Тонкие обёртки над Telegram Bot API. Токен — только из env, никогда не хардкодим.

const API_BASE = "https://api.telegram.org";

function botToken(): string | null {
  return process.env.TELEGRAM_BOT_TOKEN?.trim() || null;
}

type InlineKeyboard = { inline_keyboard: Array<Array<{ text: string; callback_data: string }>> };

type SendMessageOptions = {
  chatId: number | string;
  text: string;
  replyMarkup?: InlineKeyboard;
};

/** Отправить сообщение. Возвращает message_id или null (например, если токен не задан). */
export async function sendMessage(opts: SendMessageOptions): Promise<number | null> {
  const token = botToken();
  if (!token) return null;

  try {
    const response = await fetch(`${API_BASE}/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: opts.chatId,
        text: opts.text,
        reply_markup: opts.replyMarkup,
      }),
    });
    if (!response.ok) return null;
    const data = (await response.json()) as { result?: { message_id?: number } };
    return data.result?.message_id ?? null;
  } catch {
    return null;
  }
}

/** Ответить на нажатие кнопки (убирает «часики» у кнопки, можно показать всплывашку). */
export async function answerCallbackQuery(callbackQueryId: string, text?: string): Promise<void> {
  const token = botToken();
  if (!token) return;
  await fetch(`${API_BASE}/bot${token}/answerCallbackQuery`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ callback_query_id: callbackQueryId, text }),
  }).catch(() => undefined);
}

type EditMessageTextOptions = {
  chatId: number | string;
  messageId: number;
  text: string;
  replyMarkup?: InlineKeyboard;
};

/** Перерисовать текст и кнопки существующего сообщения (карточки заявки после действия). */
export async function editMessageText(opts: EditMessageTextOptions): Promise<void> {
  const token = botToken();
  if (!token) return;
  await fetch(`${API_BASE}/bot${token}/editMessageText`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: opts.chatId,
      message_id: opts.messageId,
      text: opts.text,
      // Пустой inline_keyboard убирает кнопки у финальных статусов (выполнен/отменён)
      reply_markup: opts.replyMarkup ?? { inline_keyboard: [] },
    }),
  }).catch(() => undefined);
}
