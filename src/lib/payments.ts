import "server-only";
import type { Order, PaymentProvider } from "@/src/types";

export type PaymentMode = "demo" | "freedom" | "halyk" | "manual";

export type PaymentLink = {
  paymentId: string;
  paymentProvider: PaymentProvider;
  paymentUrl: string;
};

export function getPaymentMode(): PaymentMode {
  const mode = process.env.PAYMENT_MODE?.trim().toLowerCase();

  if (mode === "demo" || mode === "freedom" || mode === "halyk") {
    return mode;
  }

  return "manual";
}

export function isDemoPaymentMode() {
  return getPaymentMode() === "demo";
}

export function createPaymentLink(
  order: Order,
  provider?: PaymentProvider,
  origin = "",
): PaymentLink {
  const paymentMode = provider ?? getPaymentMode();

  if (paymentMode === "kaspi_later") {
    throw new Error("Kaspi provider is reserved for a future integration");
  }

  if (paymentMode === "halyk" || paymentMode === "freedom") {
    throw new Error(
      `${paymentMode} payment provider is selected but its credentials and adapter are not configured`,
    );
  }

  const normalizedOrigin = origin.replace(/\/$/, "");
  const isDemo = paymentMode === "demo";

  return {
    paymentId: isDemo
      ? `demo-${crypto.randomUUID()}`
      : `manual-${order.order_number}`,
    paymentProvider: "manual",
    paymentUrl: `${normalizedOrigin}/pay/${order.id}`,
  };
}
