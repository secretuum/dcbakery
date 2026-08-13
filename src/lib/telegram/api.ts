import "server-only";

// Тонкие обёртки над Telegram Bot API. Токен — только из env, никогда не хардкодим.

const API_BASE = "https://api.telegram.org";

function botToken(): string | null {
  return process.env.TELEGRAM_BOT_TOKEN?.trim() || null;
}

type InlineKeyboard = { inline_keyboard: Array<Array<{ text: string; callback_data: string }>> };

// Постоянная клавиатура под полем ввода (кнопка «Заказы» у бухгалтера в ЛС).
type ReplyKeyboard = {
  keyboard: Array<Array<{ text: string }>>;
  resize_keyboard?: boolean;
  is_persistent?: boolean;
};

type SendMessageOptions = {
  chatId: number | string;
  text: string;
  replyMarkup?: InlineKeyboard | ReplyKeyboard;
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

/**
 * Скачать файл, присланный в бот (getFile → download). Хост — api.telegram.org (доверенный,
 * URL строим из file_path + нашего токена, без пользовательского URL → без SSRF). Лимит
 * размера — ранний отсев по file_size и повторно по факту. null при любой ошибке/превышении.
 */
export async function downloadTelegramFile(
  fileId: string,
  maxBytes: number,
): Promise<{ bytes: Uint8Array; mimeType: string | null } | null> {
  const token = botToken();
  if (!token || !fileId) return null;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);
  try {
    const metaRes = await fetch(`${API_BASE}/bot${token}/getFile?file_id=${encodeURIComponent(fileId)}`, {
      signal: controller.signal,
      cache: "no-store",
    });
    if (!metaRes.ok) return null;
    const meta = (await metaRes.json()) as { result?: { file_path?: string; file_size?: number } };
    const filePath = meta.result?.file_path;
    if (!filePath) return null;
    if (meta.result?.file_size && meta.result.file_size > maxBytes) return null; // ранний отсев

    const fileRes = await fetch(`${API_BASE}/file/bot${token}/${filePath}`, {
      signal: controller.signal,
      cache: "no-store",
    });
    if (!fileRes.ok) return null;
    const declared = Number(fileRes.headers.get("content-length") ?? "0");
    if (declared && declared > maxBytes) return null;
    const buf = new Uint8Array(await fileRes.arrayBuffer());
    if (buf.byteLength > maxBytes) return null;
    return { bytes: buf, mimeType: fileRes.headers.get("content-type") };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
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
