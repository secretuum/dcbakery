import type { Metadata } from "next";
import { ProfileClient } from "@/src/components/profile/ProfileClient";

export const metadata: Metadata = {
  title: "Профиль | DC Bakery",
  description: "Единый вход в клиентский кабинет и админку DC Bakery.",
};

export default function ProfilePage() {
  return <ProfileClient />;
}
