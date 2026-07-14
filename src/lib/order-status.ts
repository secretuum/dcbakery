import type { ClientStatus, OrderStatus, PaymentStatus } from "@/src/types";

type StatusVariant = "coral" | "burgundy" | "dark" | "neutral" | "green" | "blue" | "amber" | "red";

export const canonicalOrderStatuses = [
  "pending_manager_confirmation",
  "change_proposed",
  "confirmed_waiting_payment",
  "paid",
  "in_progress",
  "delivering",
  "completed",
  "canceled",
] as const satisfies readonly OrderStatus[];

export const orderStatusLabels: Record<OrderStatus, string> = {
  pending_manager_confirmation: "Ждет подтверждения",
  change_proposed: "На согласовании",
  confirmed_waiting_payment: "Ждет оплаты",
  paid: "Оплачен",
  in_progress: "В работе",
  delivering: "Доставляется",
  completed: "Завершен",
  canceled: "Отменен",
  new: "Новая",
  confirmed: "Подтверждена",
  ready: "Готова",
  delivered: "Доставлена",
  cancelled: "Отменена",
};

export const orderStatusVariants: Record<OrderStatus, StatusVariant> = {
  pending_manager_confirmation: "amber",
  change_proposed: "amber",
  confirmed_waiting_payment: "amber",
  paid: "green",
  in_progress: "blue",
  delivering: "blue",
  completed: "green",
  canceled: "red",
  new: "amber",
  confirmed: "green",
  ready: "green",
  delivered: "green",
  cancelled: "red",
};

export const paymentStatusLabels: Record<PaymentStatus, string> = {
  unpaid: "Не оплачен",
  payment_link_created: "Счет готов",
  payment_link_sent: "Счет отправлен",
  partial: "Частично оплачен",
  paid: "Оплачен",
  failed: "Ошибка оплаты",
  expired: "Ссылка истекла",
  refunded: "Возврат",
};

// Client-facing order status labels (no internal jargon)
export const clientOrderStatusLabels: Partial<Record<OrderStatus, string>> = {
  pending_manager_confirmation: "В производстве",
  change_proposed: "Предложены изменения",
  confirmed_waiting_payment: "Ожидает оплаты",
  paid: "Оплачен",
  delivering: "Отгружен",
  completed: "Завершён",
  canceled: "Отменён",
  cancelled: "Отменён",
};

export const creditStatusLabels: Record<ClientStatus, string> = {
  active: "Кредит активен",
  prepay_only: "Только предоплата",
  blocked: "Отгрузки приостановлены",
};

export function isCanonicalOrderStatus(status: OrderStatus) {
  return canonicalOrderStatuses.includes(status as (typeof canonicalOrderStatuses)[number]);
}
