// Формирование текстов ответов клиенту. Чистые функции (без сети/БД) → тестируемо и
// единый стиль. Тон — как у существующего бота: коротко, по делу, с итогом и вопросом.

import type { CartView, CartAdjustment } from "../cart/cart-math";

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
    "Всё верно? Напишите «да» — оформим, или добавьте/уберите позиции.",
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
  return "Отлично! Теперь напишите адрес доставки (по Алматы).";
}

export function askAddressWithSaved(saved: string[]): string {
  const list = saved.map((a, i) => `${i + 1}) ${a}`).join("\n");
  return [
    "Куда доставить? Выберите сохранённый адрес номером или напишите новый (по Алматы):",
    "",
    list,
  ].join("\n");
}

export function confirmAddress(normalized: string): string {
  return `Проверьте адрес:\n${normalized}\n\nВсё верно? Напишите «да» или пришлите исправленный адрес.`;
}

export function addressOutsideAlmaty(): string {
  return "К сожалению, доставляем только по Алматы. Передаю ваш заказ менеджеру — он свяжется с вами по вариантам.";
}

export function addressUncertain(): string {
  return "Не удалось однозначно определить адрес в Алматы. Уточните, пожалуйста, улицу и дом (или напишите «менеджер»).";
}

export function askDeliveryPeriod(): string {
  return "Когда удобнее доставка? Ответьте: «утро» (первая половина дня) или «день» (вторая). Обе — до 18:00.";
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
    "Оформляем? Напишите «да» — отправлю заявку менеджеру.",
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
    `Заявка ${orderNumber} принята ✅`,
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
  "Передаю диалог менеджеру — он скоро свяжется с вами. Спасибо!";

export const MSG_ATTACHMENT =
  "Для оформления заказа отправьте, пожалуйста, текстовое или голосовое сообщение длительностью до 60 секунд.";

export const MSG_VOICE_TOO_LONG =
  "Голосовое длиннее 60 секунд я не разберу. Пришлите, пожалуйста, сообщение покороче или текстом.";

export const MSG_VOICE_BAD =
  "Не удалось распознать голосовое. Пришлите заказ текстом или запишите ещё раз (до 60 секунд).";

export const MSG_CANCELLED = "Заказ отменён. Обращайтесь снова — соберём новый.";

export const MSG_UNKNOWN =
  "Напишите заказ обычными словами — например: «3 медовика, 2 наполеона». Или отправьте голосовое до 60 секунд.";

export const MSG_EMPTY_AFTER_POLICY =
  "Не увидел товаров в сообщении. Напишите, что и сколько добавить — например: «4 сырника, 1 медовик».";
