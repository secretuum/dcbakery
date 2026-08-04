// Тир аккаунта клиента: lite (облегчённый) ↔ full (полный). Чистый модуль без
// server-only/сети — переиспользуется на сервере (заказы, статусы) и в UI, покрыт
// тестами. Тир управляет ПОТОЛКОМ суммы заказа и объёмом UI; ДЕНЬГИ (предоплата
// vs отсрочка) — отдельная ось (credit_limit), см. shipmentBlockedForPrepay.

export type AccountTier = "lite" | "full";

/** Потолок суммы одного заказа для лайт-аккаунта (₸). Это анти-спам, не финзащита —
 * деньги защищены обязательной предоплатой. Полный аккаунт потолка не имеет. */
export const LITE_ORDER_CAP = 500_000;

/** Статусы заказа, означающие отгрузку/фулфилмент (товар поехал/списан). */
const SHIPMENT_STATUSES = new Set(["in_progress", "delivering", "completed"]);

export type AccountTierInput = {
  /** БИН/ИИН из профиля (валидность формата проверяется при сохранении профиля). */
  customerBin?: string | null;
  /** Есть ли у клиента адрес доставки. */
  hasAddress?: boolean | null;
  /** Кредитный лимит из таблицы clients (0 у самозарегистрированных). */
  creditLimit?: number | null;
};

/**
 * Тир аккаунта. Полный, если менеджер открыл кредит (credit_limit>0) ИЛИ клиент
 * сам дозаполнил профиль (БИН + адрес). Иначе — облегчённый.
 * ВАЖНО: полный тир снимает потолок и открывает UI, но НЕ даёт денежных
 * привилегий — отсрочку (отгрузку до оплаты) даёт только credit_limit>0 (менеджер).
 */
export function getAccountTier(input: AccountTierInput): AccountTier {
  if ((input.creditLimit ?? 0) > 0) return "full";
  const hasBin = typeof input.customerBin === "string" && input.customerBin.trim().length > 0;
  if (hasBin && input.hasAddress === true) return "full";
  return "lite";
}

/** Превышает ли сумма заказа потолок лайт-аккаунта (полный — без потолка). */
export function isOverLiteCap(tier: AccountTier, orderSum: number): boolean {
  return tier === "lite" && orderSum > LITE_ORDER_CAP;
}

export type ShipmentGuardInput = {
  targetStatus: string;
  paymentStatus?: string | null;
  creditLimit?: number | null;
  hasClient: boolean;
};

/**
 * Нужно ли ЗАБЛОКИРОВАТЬ перевод заказа в статус отгрузки из-за неоплаты.
 * Блокируем, если: у заказа есть привязанный клиент, кредит не открыт
 * (credit_limit===0 ⇒ предоплатный клиент), заказ НЕ оплачен и целевой статус —
 * отгрузочный. Клиентам с credit_limit>0 (отсрочка от менеджера) — не мешаем
 * (легальная консигнация). Заказы без клиента (гость/легаси) не трогаем.
 * Ключ на credit_limit (стабильное поле менеджера), не на живом credit-статусе —
 * иначе циркулярность (перевод в in_progress сам добавляет долг) и регресс
 * консигнации активных клиентов.
 */
export function shipmentBlockedForPrepay(input: ShipmentGuardInput): boolean {
  if (!input.hasClient) return false;
  if (!SHIPMENT_STATUSES.has(input.targetStatus)) return false;
  if ((input.creditLimit ?? 0) > 0) return false; // менеджер открыл отсрочку
  return input.paymentStatus !== "paid";
}
