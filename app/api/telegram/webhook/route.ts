import { NextResponse } from "next/server";
import { getRole, roleLabels, canDo } from "@/src/lib/telegram/roles";
import { sendMessage, answerCallbackQuery } from "@/src/lib/telegram/api";
import { logAction } from "@/src/lib/audit";

const actionLabels: Record<string, string> = {
  confirm: "Подтвердить",
  reject: "Отклонить",
  cancel: "Отменить",
  paid: "Оплачено",
  unpaid: "Снять оплату",
  work: "В работу",
  deliver: "Доставляется",
  done: "Выполнен",
};

function displayName(from: TgUser) {
  return [from.first_name, from.last_name].filter(Boolean).join(" ") || from.username || "";
}

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
  callback_query?: {
    id: string;
    from: TgUser;
    data?: string;
    message?: { chat: { id: number }; message_id: number };
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

  // Нажатие кнопки в карточке заявки
  const cb = update.callback_query;
  if (cb) {
    const role = getRole(cb.from.id);
    const [action, orderId] = (cb.data ?? "").split(":");

    if (!role) {
      await answerCallbackQuery(cb.id, "Доступа нет");
      return NextResponse.json({ ok: true });
    }
    if (!action || !canDo(role, action)) {
      await answerCallbackQuery(cb.id, "Недостаточно прав для этого действия");
      return NextResponse.json({ ok: true });
    }

    // ШАГ 2: пока заглушка — только журнал и подтверждение. Реальное изменение
    // заказа подключим на шаге 3.
    await logAction({
      source: "telegram",
      actorTelegramId: cb.from.id,
      actorRole: role,
      actorName: displayName(cb.from),
      action,
      orderId: orderId || null,
      details: { stub: true },
    });
    await answerCallbackQuery(
      cb.id,
      `«${actionLabels[action] ?? action}» принято (демо). Реальное действие — на шаге 3.`,
    );
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
