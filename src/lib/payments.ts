import type { Order, PaymentProvider } from "@/src/types";

export type PaymentLink = {
  paymentId: string;
  paymentProvider: PaymentProvider;
  paymentUrl: string;
};

export function createPaymentLink(
  order: Order,
  provider: PaymentProvider = "manual",
  origin = "",
): PaymentLink {
  if (provider === "kaspi_later") {
    throw new Error("Kaspi provider is reserved for a future integration");
  }

  if (provider === "halyk" || provider === "freedom") {
    throw new Error(`${provider} payment provider is not configured yet`);
  }

  const normalizedOrigin = origin.replace(/\/$/, "");

  return {
    paymentId: `manual-${order.order_number}`,
    paymentProvider: "manual",
    paymentUrl: `${normalizedOrigin}/pay/${order.id}`,
  };
}
