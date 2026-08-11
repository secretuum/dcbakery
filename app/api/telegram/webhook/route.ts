import { NextResponse } from "next/server";
import type { Order } from "@/src/types";
import { getRole, roleLabels, canDo } from "@/src/lib/telegram/roles";
import { sendMessage, answerCallbackQuery, editMessageText } from "@/src/lib/telegram/api";
import { buildOrderCard } from "@/src/lib/telegram/order-card";
import {
  accountantKeyboard,
  buildAccountantDetail,
  buildAwaitingPaymentList,
  buildPaidList,
  isAwaitingCommand,
  isPaidCommand,
  notifyAccountantsAwaitingPayment,
} from "@/src/lib/telegram/accountant";
import { fetchAwaitingPaymentOrders, fetchPaidOrders } from "@/src/lib/orders/awaiting-payment";
import {
  getBotKnowledgeEntries,
  appendBotKnowledgeEntry,
  clearBotKnowledge,
} from "@/src/lib/whatsapp/orders/agent/knowledge-store-io";
import { formatKnowledgeList } from "@/src/lib/whatsapp/orders/agent/knowledge-store";
import { getBotStats } from "@/src/lib/whatsapp/orders/stats/bot-stats";
import { formatBotStats } from "@/src/lib/whatsapp/orders/stats/bot-stats-format";
import { logAction } from "@/src/lib/audit";
import { fetchAdminOrder, fetchAdminOrderItems } from "@/src/lib/supabase/admin";
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

// Перерисовать карточку заявки В ОБЩЕМ ЧАТЕ под новый статус. Id группового
// сообщения хранится в order.telegram_message_id, поэтому карточка обновляется
// даже когда действие пришло из ЛС бухгалтера, а не из самой группы.
async function refreshGroupCard(order: Order): Promise<void> {
  const chatId =
    process.env.TELEGRAM_GROUP_CHAT_ID?.trim() || process.env.TELEGRAM_CHAT_ID?.trim();
  const messageId = order.telegram_message_id ? Number(order.telegram_message_id) : null;
  if (!chatId || !messageId || Number.isNaN(messageId)) return;

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

    // Открыть детали заказа из раздела «Заказы» (read-only, бухгалтер/админ)
    if (action === "open") {
      if (role !== "accountant" && role !== "admin") {
        await answerCallbackQuery(cb.id, "Недостаточно прав");
        return NextResponse.json({ ok: true });
      }
      const order = orderId ? await fetchAdminOrder(orderId) : null;
      if (!order) {
        await answerCallbackQuery(cb.id, "Заявка не найдена");
        return NextResponse.json({ ok: true });
      }
      const openOrigin = process.env.NEXT_PUBLIC_SITE_URL ?? new URL(request.url).origin;
      const detail = await buildAccountantDetail(order, openOrigin);
      if (cb.message) {
        await sendMessage({ chatId: cb.message.chat.id, text: detail.text, replyMarkup: detail.replyMarkup });
      }
      await answerCallbackQuery(cb.id);
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

    if (outcome.order) {
      await refreshGroupCard(outcome.order);
    }

    // Оплата/снятие оплаты нажата в ЛС бухгалтера — обновляем ЭТО же сообщение:
    // «Оплачено» → «✅ №… — оплачено» (кнопка исчезает), «Снять оплату» → снова карточка с кнопкой.
    if ((action === "paid" || action === "unpaid") && cb.message && outcome.order) {
      const dm = await buildAccountantDetail(outcome.order, origin);
      await editMessageText({
        chatId: cb.message.chat.id,
        messageId: cb.message.message_id,
        text: dm.text,
        replyMarkup: dm.replyMarkup,
      }).catch(() => undefined);
    }

    // Подтверждение → реквизиты заказа бухгалтеру(ам) в ЛС (кнопка «Оплачено»)
    if (action === "confirm" && outcome.order) {
      await notifyAccountantsAwaitingPayment(outcome.order, origin).catch(() => undefined);
    }

    await answerCallbackQuery(cb.id, `Готово: ${actionLabels[action] ?? action}`);
    return NextResponse.json({ ok: true });
  }

  const message = update.message;
  const from = message?.from;
  const text = message?.text;

  if (message && from && typeof text === "string") {
    const role = getRole(from.id);
    const trimmed = text.trim();
    // В приватном чате chat.id === id пользователя (в группе — отрицательный).
    const isPrivate = message.chat.id === from.id;

    if (trimmed.toLowerCase().startsWith("/start")) {
      const name = [from.first_name, from.last_name].filter(Boolean).join(" ") || from.username || "";
      const roleLine = role
        ? `Ваша роль: ${roleLabels[role]}. Доступ есть.`
        : "Доступа пока нет. Передайте свой ID администратору — он добавит вас в переменные.";
      // Маркетологу в личке подсказываем, как редактировать базу знаний бота.
      const marketerHint =
        role === "marketer"
          ? "\n\nПросто присылайте сюда факты, акции и уточнения — я добавлю их в базу знаний бота. Команды: /база — показать, /очистить — стереть, /статистика — цифры бота."
          : "";
      // Бухгалтеру/админу в личке даём постоянную кнопку «Заказы».
      const withKeyboard = isPrivate && (role === "accountant" || role === "admin");

      await sendMessage({
        chatId: message.chat.id,
        text: `Привет${name ? `, ${name}` : ""}!\nВаш Telegram ID: ${from.id}\n${roleLine}${marketerHint}`,
        replyMarkup: withKeyboard ? accountantKeyboard() : undefined,
      });
    } else if (isPrivate && role === "marketer") {
      // Маркетолог редактирует живую базу знаний бота прямо сообщениями в ЛС (максимально
      // просто: любой текст = добавить факт). Пишется в app_settings, применяется на лету.
      const lower = trimmed.toLowerCase();
      if (lower === "/база" || lower === "/знания" || lower === "/base") {
        const entries = await getBotKnowledgeEntries();
        await sendMessage({
          chatId: message.chat.id,
          text: `База знаний бота — записей: ${entries.length}\n\n${formatKnowledgeList(entries)}`,
        });
      } else if (lower === "/очистить" || lower === "/сброс" || lower === "/clear") {
        await clearBotKnowledge();
        await sendMessage({
          chatId: message.chat.id,
          text: "База знаний очищена. Бот снова работает только на базовых правилах.",
        });
      } else if (lower === "/статистика" || lower === "/стата" || lower === "/stats") {
        await sendMessage({ chatId: message.chat.id, text: formatBotStats(await getBotStats(Date.now())) });
      } else if (trimmed.startsWith("/")) {
        await sendMessage({
          chatId: message.chat.id,
          text: "Просто пришлите текст — добавлю его в базу знаний бота. Команды: /база — показать, /очистить — стереть, /статистика — цифры бота.",
        });
      } else {
        const author = [from.first_name, from.last_name].filter(Boolean).join(" ") || from.username || String(from.id);
        const count = await appendBotKnowledgeEntry(trimmed, author, new Date().toISOString());
        await sendMessage({
          chatId: message.chat.id,
          text: `Добавил в базу знаний бота (всего записей: ${count}):\n«${trimmed.slice(0, 200)}»\n\nПоказать всё — /база, стереть — /очистить.`,
        });
      }
    } else if (isPrivate && (isAwaitingCommand(trimmed) || isPaidCommand(trimmed))) {
      // Разделы «Ждут оплаты» / «Оплаченные» — только бухгалтеру/админу и только в ЛС.
      if (role === "accountant" || role === "admin") {
        const list = isPaidCommand(trimmed)
          ? buildPaidList(await fetchPaidOrders())
          : buildAwaitingPaymentList(await fetchAwaitingPaymentOrders());
        await sendMessage({ chatId: message.chat.id, text: list.text, replyMarkup: list.replyMarkup });
      } else {
        await sendMessage({ chatId: message.chat.id, text: "Доступа нет." });
      }
    }
  }

  // Telegram ждёт 200, иначе повторяет апдейт
  return NextResponse.json({ ok: true });
}
