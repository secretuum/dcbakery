import type { Metadata } from "next";
import { CheckoutForm } from "@/src/components/checkout/CheckoutForm";
import { getSiteContent } from "@/src/lib/site-content";

export const metadata: Metadata = {
  title: "Оформление заявки | DC Bakery",
  description: "B2B-оформление заявки DC Bakery: контакты, доставка и способ оплаты.",
};

export default async function CheckoutPage() {
  const content = await getSiteContent();

  return (
    <CheckoutForm
      deliveryDays={content.deliveryDays}
      cutoffHour={content.orderCutoffHour}
    />
  );
}
