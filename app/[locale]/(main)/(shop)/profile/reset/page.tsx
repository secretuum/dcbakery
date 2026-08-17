import type { Metadata } from "next";
import { ResetPasswordClient } from "@/src/components/profile/ResetPasswordClient";

export const metadata: Metadata = {
  title: "Сброс пароля | DC Bakery",
  description: "Установка нового пароля для личного кабинета DC Bakery.",
};

export default function ResetPasswordPage() {
  return <ResetPasswordClient />;
}
