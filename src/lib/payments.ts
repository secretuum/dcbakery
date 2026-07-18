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

  if (mode === "demo" || mode === "freedom" || mode === "halyk" || mode === "manual") {
    return mode;
  }

  // Безопасный дефолт: без явного PAYMENT_MODE работаем «по счёту», а не демо-шлюзом.
  // Демо включается только осознанно: PAYMENT_MODE=demo.
  return "manual";
}

export function isDemoPaymentMode() {
  return getPaymentMode() === "demo";
}

function getDemoPaymentSecret() {
  return (
    process.env.DEMO_PAYMENT_SECRET ||
    process.env.PAYMENT_WEBHOOK_SECRET ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    "dc-bakery-local-demo"
  );
}

export async function createDemoPaymentToken(orderId: string, paymentId: string) {
  const { createHmac } = await import("node:crypto");

  return createHmac("sha256", getDemoPaymentSecret())
    .update(`${orderId}:${paymentId}`)
    .digest("hex");
}

export async function verifyDemoPaymentToken(
  orderId: string,
  paymentId: string,
  token: string,
) {
  const { timingSafeEqual } = await import("node:crypto");
  const expectedToken = await createDemoPaymentToken(orderId, paymentId);
  const expectedBuffer = Buffer.from(expectedToken);
  const tokenBuffer = Buffer.from(token);

  return (
    expectedBuffer.length === tokenBuffer.length &&
    timingSafeEqual(expectedBuffer, tokenBuffer)
  );
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

  if (paymentMode === "freedom") {
    throw new Error(
      "freedom payment provider is selected but its credentials and adapter are not configured",
    );
  }

  const normalizedOrigin = origin.replace(/\/$/, "");

  // Halyk: ссылка ведёт на нашу страницу заказа — кнопка «Оплатить картой»
  // создаёт попытку и открывает платёжную страницу Halyk (см. /pay/[orderId]/card)
  if (paymentMode === "halyk") {
    return {
      paymentId: `halyk-${order.order_number}`,
      paymentProvider: "halyk",
      paymentUrl: `${normalizedOrigin}/pay/${order.id}`,
    };
  }

  const isDemo = paymentMode === "demo";

  return {
    paymentId: isDemo
      ? `demo-${crypto.randomUUID()}`
      : `manual-${order.order_number}`,
    paymentProvider: "manual",
    paymentUrl: `${normalizedOrigin}/pay/${order.id}`,
  };
}
