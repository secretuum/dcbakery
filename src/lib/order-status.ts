import type { OrderStatus, PaymentStatus } from "@/src/types";

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

export const orderStatusVariants: Record<OrderStatus, "coral" | "burgundy" | "dark" | "neutral"> = {
  pending_manager_confirmation: "coral",
  change_proposed: "burgundy",
  confirmed_waiting_payment: "burgundy",
  paid: "neutral",
  in_progress: "dark",
  delivering: "dark",
  completed: "neutral",
  canceled: "dark",
  new: "coral",
  confirmed: "burgundy",
  ready: "neutral",
  delivered: "neutral",
  cancelled: "dark",
};

export const paymentStatusLabels: Record<PaymentStatus, string> = {
  unpaid: "Не оплачен",
  payment_link_created: "Ссылка создана",
  payment_link_sent: "Ссылка отправлена",
  paid: "Оплачен",
  failed: "Ошибка оплаты",
  expired: "Ссылка истекла",
  refunded: "Возврат",
};

export function isCanonicalOrderStatus(status: OrderStatus) {
  return canonicalOrderStatuses.includes(status as (typeof canonicalOrderStatuses)[number]);
}
