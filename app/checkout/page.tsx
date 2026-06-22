import type { Metadata } from "next";
import { CheckoutForm } from "@/src/components/checkout/CheckoutForm";

export const metadata: Metadata = {
  title: "Оформление заявки | DC Bakery",
  description: "B2B-оформление заявки DC Bakery: контакты, доставка и способ оплаты.",
};

export default function CheckoutPage() {
  return <CheckoutForm />;
}
