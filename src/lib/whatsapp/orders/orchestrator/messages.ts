// Формирование текстов ответов клиенту. Чистые функции (без сети/БД) → тестируемо и
// единый стиль. Тон — как у существующего бота: коротко, по делу, с итогом и вопросом.

import type { CartView, CartAdjustment } from "../cart/cart-math";
import { MIN_ORDER_AMOUNT } from "@/app/constants";

function tenge(amount: number): string {
  const rounded = Math.round(amount);
  const s = Math.abs(rounded).toString();
  const withSep = s.replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  return `${rounded < 0 ? "-" : ""}${withSep} ₸`;
}

/** Основная карточка корзины с итогом и доставкой. */
export function formatCart(view: CartView): string {
  if (view.lines.length === 0) return "Корзина пуста. Напишите, что добавить.";

  const lines = view.lines.map((l, i) => {
    const weight = l.weightLabel ? ` · ${l.weightLabel}` : "";
    return `${i + 1}. ${l.name}${weight}\n   ${l.qty} × ${tenge(l.price)} = ${tenge(l.lineTotal)}`;
  });

  return [
    "Ваша корзина:",
    "",
    ...lines,
    "",
    `Товары: ${tenge(view.itemsTotal)}`,
    view.delivery > 0 ? `Доставка: ${tenge(view.delivery)}` : "Доставка: бесплатно",
    `Итого: ${tenge(view.grandTotal)}`,
    "",
    "Всё как надо? Напишите «да» — и оформим. Или добавьте/уберите что-нибудь — как вам удобно.",
  ].join("\n");
}

/** Сообщение, когда сумма корзины ниже минимальной — оформление не пускаем. */
export function belowMinimum(itemsTotal: number): string {
  const missing = Math.max(MIN_ORDER_AMOUNT - itemsTotal, 0);
  return [
    `Минимальная сумма заказа — ${tenge(MIN_ORDER_AMOUNT)}.`,
    `Сейчас в корзине ${tenge(itemsTotal)} — добавьте ещё ${tenge(missing)}, и оформим. Доставка по Алматы бесплатная.`,
  ].join("\n");
}

/** Заметка об урезании по остатку (что не поместилось). */
export function formatAdjustments(
  adjustments: CartAdjustment[],
  nameById: Map<string, string>,
): string | null {
  if (adjustments.length === 0) return null;
  const lines = adjustments.map((a) => {
    const name = nameById.get(a.productId) ?? a.productId;
    if (a.reason === "out_of_stock") return `• ${name}: сейчас нет в наличии`;
    return `• ${name}: доступно ${a.available} — добавили столько`;
  });
  return ["Уточнение по наличию:", ...lines].join("\n");
}

/** Розничные позиции → ссылка на del Cappuccino. */
export function formatRetailNotice(retailNames: string[], retailUrl: string): string | null {
  if (retailNames.length === 0) return null;
  const list = retailNames.map((n) => `«${n}»`).join(", ");
  return [
    `${list} — это позиции кафе del Cappuccino, их нет в оптовом каталоге DC Bakery.`,
    `Заказать их можно здесь: ${retailUrl}`,
  ].join("\n");
}

/**
 * Мягкая подсказка со ссылкой на розницу для НЕизвестных позиций (без объявления их
 * розницей). Даём ссылку вместо перечисления меню кафе.
 */
export function formatRetailHint(retailUrl: string): string {
  return `Если что-то из этого — позиция кафе del Cappuccino, её можно заказать здесь: ${retailUrl}`;
}

/** Неизвестные позиции с уточнением (до 3 вариантов). */
export function formatClarifications(
  clarifications: Array<{ rawName: string; candidates: Array<{ name: string }> }>,
): string | null {
  if (clarifications.length === 0) return null;
  const blocks = clarifications.map((c) => {
    if (c.candidates.length === 0) {
      return `«${c.rawName}» — не нашли в каталоге. Уточните название.`;
    }
    const options = c.candidates.map((cand, i) => `${i + 1}) ${cand.name}`).join("\n");
    return `«${c.rawName}» — что именно?\n${options}`;
  });
  return blocks.join("\n\n");
}

export function askAddress(): string {
  return [
    "Супер, оформим доставку. Подскажите адрес — куда привезти по Алматы?",
    "",
    "Если захотите ещё что-то добавить или вернуться к заказу — просто напишите «назад».",
  ].join("\n");
}

export function askAddressWithSaved(saved: string[]): string {
  const list = saved.map((a, i) => `${i + 1}) ${a}`).join("\n");
  return [
    "Куда привезти? Можно выбрать сохранённый адрес номером или прислать новый (по Алматы):",
    "",
    list,
    "",
    "А если передумали — напишите «назад», вернёмся к заказу.",
  ].join("\n");
}

export function confirmAddress(normalized: string): string {
  return `Уточню адрес:\n${normalized}\n\nВсё верно? Напишите «да» — или пришлите правильный. («назад» — вернуться к заказу.)`;
}

export function addressOutsideAlmaty(): string {
  return "Пока возим только по Алматы. Передаю ваш заказ менеджеру — он свяжется и подскажет по вариантам.";
}

export function addressUncertain(): string {
  return "Кажется, тут не распознал адрес по Алматы. Напишите, пожалуйста, улицу и дом. Если удобнее — напишите «менеджер», или «назад», чтобы вернуться к заказу.";
}

export function askDeliveryPeriod(): string {
  return "Когда удобнее привезти — утром (первая половина дня) или днём (вторая)? Обе — до 18:00.\n\n(Если хотите что-то поменять в заказе — напишите «назад».)";
}

/** Финальная сводка перед созданием заявки. */
export function formatFinalSummary(input: {
  view: CartView;
  address: string;
  period: string;
  phone: string;
}): string {
  return [
    "Проверьте заказ перед оформлением:",
    "",
    formatCart(input.view),
    "",
    `Адрес: ${input.address}`,
    `Доставка: ${input.period}`,
    `Телефон: ${input.phone}`,
    "",
    "Оформляем? Напишите «да» — и я передам заявку менеджеру. Или «назад», если хотите что-то поправить.",
  ].join("\n");
}

export function formatRegistrationLink(url: string): string {
  return [
    "Чтобы в следующий раз оформлять быстрее — заполните профиль (компания, реквизиты):",
    url,
    "Ссылка одноразовая, действует 30 минут.",
  ].join("\n");
}

export function formatOrderCreated(orderNumber: string): string {
  return [
    `Заявка ${orderNumber} принята.`,
    "",
    "Менеджер проверит наличие и сумму, затем подтвердит заказ и пришлёт счёт.",
    "Статус придёт сюда, в WhatsApp.",
  ].join("\n");
}

export function periodLabel(period: "morning" | "afternoon"): string {
  return period === "morning" ? "Утро (первая половина дня)" : "День (вторая половина дня)";
}

export const MSG_EXPIRED =
  "Сессия оформления истекла (прошло больше часа). Начнём заново — напишите заказ ещё раз, я пересчитаю актуальные цены и наличие.";

export const MSG_HANDOFF =
  "Спасибо, что обратились. Я передал ваш вопрос менеджеру — он скоро подключится и поможет вам. Пожалуйста, немного подождите, вы обязательно получите ответ.";

export const MSG_ATTACHMENT =
  "Для оформления заказа отправьте, пожалуйста, текстовое или голосовое сообщение длительностью до 60 секунд.";

export const MSG_MEDIA_BAD =
  "Не удалось разобрать файл. Я передал его менеджеру — он поможет. При желании можно прислать заказ текстом или фото почётче.";

export const MSG_VOICE_TOO_LONG =
  "Голосовое длиннее 60 секунд я не разберу. Пришлите, пожалуйста, сообщение покороче или текстом.";

export const MSG_VOICE_BAD =
  "Не удалось распознать голосовое. Пришлите заказ текстом или запишите ещё раз (до 60 секунд).";

export const MSG_CANCELLED = "Заказ отменён. Обращайтесь снова — соберём новый.";

export const MSG_UNKNOWN =
  "Напишите заказ обычными словами — например: «3 медовика, 2 наполеона». Или отправьте голосовое до 60 секунд.";

/** Мягкое уточнение, когда намерение непонятно (НЕ «нет товаров»). */
export const MSG_CLARIFY =
  "Подскажите, чем помочь? Могу показать каталог и цены, подобрать позиции под ваш формат или собрать заказ.";

/** Временный технический сбой (LLM/сеть недоступны) — без stack trace, вежливо. */
export const MSG_TEMPORARY_ISSUE =
  "Секунду, у меня небольшие технические неполадки. Повторите, пожалуйста, сообщение — или напишите «менеджер», и я передам диалог человеку.";

export const MSG_EMPTY_AFTER_POLICY =
  "Пока не понял, что добавить — напишите, что и сколько, например: «4 сырника, 1 медовик». Или спросите, что у нас есть, — подскажу.";

/** Тёплое приветствие + выяснение предпочтений (первый контакт). Тон профессиональный, без эмодзи. */
export function formatGreeting(categories: string[]): string {
  const list = categories.filter(Boolean);
  const assortment =
    list.length > 0
      ? `Поставляем оптом: ${list.join(", ").toLowerCase()}.`
      : "Оптовый поставщик десертов, полуфабрикатов и мяса для кафе, ресторанов, отелей и магазинов.";
  return [
    "Здравствуйте! Это виртуальный ассистент DC Bakery.",
    assortment,
    "Что вас интересует? Напишите товары и количество — например: «10 наполеонов, 5 медовиков». Можно и голосовым сообщением (до 60 секунд).",
    "Подскажу наличие и цену, помогу собрать заявку и оформить доставку по Алматы.",
  ].join("\n");
}
