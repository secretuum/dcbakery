import { NextResponse } from "next/server";
import { getRole, roleLabels } from "@/src/lib/telegram/roles";
import { sendMessage } from "@/src/lib/telegram/api";

// Вебхук Telegram-бота. Telegram присылает сюда апдейты POST-запросом и, если
// вебхук зарегистрирован с secret_token, добавляет заголовок
// X-Telegram-Bot-Api-Secret-Token — сверяем его с TELEGRAM_WEBHOOK_SECRET.
//
// Шаг 1: обрабатываем только команду /start — бот отвечает Telegram id и ролью
// пользователя. Ничего в заказах пока не трогаем.

type TgUser = {
  id: number;
  first_name?: string;
  last_name?: string;
  username?: string;
};

type TgUpdate = {
  message?: {
    chat: { id: number };
    from?: TgUser;
    text?: string;
  };
};

export async function POST(request: Request) {
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET?.trim();
  const provided = request.headers.get("x-telegram-bot-api-secret-token");

  // Без валидного секрета — не наш запрос
  if (!secret || provided !== secret) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  let update: TgUpdate;
  try {
    update = (await request.json()) as TgUpdate;
  } catch {
    // Мусор в теле не должен ронять вебхук — иначе Telegram будет слать повторы
    return NextResponse.json({ ok: true });
  }

  const message = update.message;
  const from = message?.from;
  const text = message?.text;

  if (message && from && typeof text === "string" && text.trim().toLowerCase().startsWith("/start")) {
    const role = getRole(from.id);
    const name = [from.first_name, from.last_name].filter(Boolean).join(" ") || from.username || "";
    const roleLine = role
      ? `Ваша роль: ${roleLabels[role]}. Доступ есть.`
      : "Доступа пока нет. Передайте свой ID администратору — он добавит вас в переменные.";

    await sendMessage({
      chatId: message.chat.id,
      text: `Привет${name ? `, ${name}` : ""}!\nВаш Telegram ID: ${from.id}\n${roleLine}`,
    });
  }

  // Telegram ждёт 200, иначе повторяет апдейт
  return NextResponse.json({ ok: true });
}
