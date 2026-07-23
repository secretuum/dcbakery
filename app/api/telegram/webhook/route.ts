import { NextResponse } from "next/server";
import type { Order } from "@/src/types";
import { getRole, roleLabels, canDo } from "@/src/lib/telegram/roles";
import { sendMessage, answerCallbackQuery, editMessageText } from "@/src/lib/telegram/api";
import { buildOrderCard } from "@/src/lib/telegram/order-card";
import { logAction } from "@/src/lib/audit";
import { fetchAdminOrderItems } from "@/src/lib/supabase/admin";
import {
  cancelOrderAction,
  changeStatus,
  confirmOrder,
  markPaid,
  unmarkPaid,
  type ActionError,
  type OrderActor,
} from "@/src/lib/orders/actions";

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

// Технические ошибки сервиса → короткий русский текст для всплывашки сотруднику.
const errorLabels: Record<string, string> = {
  "Order not found": "Заявка не найдена",
  "Order already confirmed": "Заявка уже подтверждена",
  "Order cannot be confirmed": "Заявку нельзя подтвердить",
  "Order cannot be marked as paid": "Заявку нельзя отметить оплаченной",
  "Paid order requires manual refund handling": "Оплаченную заявку нужно возвращать вручную",
  "Order cannot be canceled": "Заявку нельзя отменить",
  "Invalid status": "Недопустимый статус",
};

function friendlyError(message: string): string {
  return errorLabels[message] ?? message;
}

function displayName(from: TgUser) {
  return [from.first_name, from.last_name].filter(Boolean).join(" ") || from.username || "";
}

// Вебхук Telegram-бота. Telegram присылает сюда апдейты POST-запросом и, если
// вебхук зарегистрирован с secret_token, добавляет заголовок
// X-Telegram-Bot-Api-Secret-Token — сверяем его с TELEGRAM_WEBHOOK_SECRET.
//
// Обрабатываем: /start (бот отвечает Telegram id и ролью) и нажатия кнопок в
// карточке заявки (действие проверяется по роли, выполняется через общий сервис
// src/lib/orders/actions, карточка перерисовывается, всё пишется в журнал).

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

type ActionOutcome =
  | { ok: true; order: Order | null; managerMessageId: string | null }
  | ActionError;

// Маппинг кнопки → функция общего сервиса. Права уже проверены выше (canDo).
async function runAction(
  action: string,
  orderId: string,
  actor: OrderActor,
  origin: string,
): Promise<ActionOutcome> {
  switch (action) {
    case "confirm":
      return confirmOrder(orderId, { origin, actor });
    case "reject":
      return cancelOrderAction(orderId, { reason: "Отклонено в Telegram" });
    case "cancel":
      return cancelOrderAction(orderId, { reason: "Отменено в Telegram" });
    case "paid":
      return markPaid(orderId, { actor });
    case "unpaid":
      return unmarkPaid(orderId, { actor });
    case "work":
      return changeStatus(orderId, "in_progress");
    case "deliver":
      return changeStatus(orderId, "delivering");
    case "done":
      return changeStatus(orderId, "completed");
    default:
      return { ok: false, status: 400, error: "Неизвестное действие" };
  }
}

// Перерисовать карточку заявки в чате под новый статус (текст + кнопки).
async function refreshCard(
  chatId: number,
  messageId: number,
  order: Order,
): Promise<void> {
  const items = await fetchAdminOrderItems(order.id).catch(() => []);
  const { text, replyMarkup } = buildOrderCard(order, items);
  await editMessageText({ chatId, messageId, text, replyMarkup });
}

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
    if (!orderId) {
      await answerCallbackQuery(cb.id, "Заявка не найдена");
      return NextResponse.json({ ok: true });
    }

    const actor: OrderActor = {
      kind: "telegram",
      telegramId: cb.from.id,
      role,
      name: displayName(cb.from),
    };
    const origin = process.env.NEXT_PUBLIC_SITE_URL ?? new URL(request.url).origin;

    let outcome: ActionOutcome;
    try {
      outcome = await runAction(action, orderId, actor, origin);
    } catch (error) {
      await logAction({
        source: "telegram",
        actorTelegramId: cb.from.id,
        actorRole: role,
        actorName: actor.name,
        action,
        orderId,
        details: { ok: false, error: error instanceof Error ? error.message : "unknown" },
      });
      await answerCallbackQuery(cb.id, "Ошибка при выполнении действия");
      return NextResponse.json({ ok: true });
    }

    if (!outcome.ok) {
      await logAction({
        source: "telegram",
        actorTelegramId: cb.from.id,
        actorRole: role,
        actorName: actor.name,
        action,
        orderId,
        details: { ok: false, error: outcome.error },
      });
      await answerCallbackQuery(cb.id, friendlyError(outcome.error));
      return NextResponse.json({ ok: true });
    }

    // Успех: журнал + перерисовка карточки + всплывашка
    await logAction({
      source: "telegram",
      actorTelegramId: cb.from.id,
      actorRole: role,
      actorName: actor.name,
      action,
      orderId,
      orderNumber: outcome.order?.order_number ?? null,
      details: { ok: true, status: outcome.order?.status ?? null },
    });

    if (outcome.order && cb.message) {
      await refreshCard(cb.message.chat.id, cb.message.message_id, outcome.order);
    }

    await answerCallbackQuery(cb.id, `Готово: ${actionLabels[action] ?? action}`);
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
