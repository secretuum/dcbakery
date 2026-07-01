import type { Metadata } from "next";
import { ProfileClient } from "@/src/components/profile/ProfileClient";
import { fetchProducts } from "@/src/lib/catalog";

export const metadata: Metadata = {
  title: "Профиль | DC Bakery",
  description: "Единый вход в клиентский кабинет и админку DC Bakery.",
};

export default async function ProfilePage() {
  const allProducts = await fetchProducts();
  const popularProducts = allProducts
    .filter((p) => p.stock_qty > 0 && (p.popularity_rank ?? 0) > 0)
    .sort((a, b) => (b.popularity_rank ?? 0) - (a.popularity_rank ?? 0))
    .slice(0, 6);

  return <ProfileClient popularProducts={popularProducts} />;
}
