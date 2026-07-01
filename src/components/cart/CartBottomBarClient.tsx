"use client";

import dynamic from "next/dynamic";

const CartSheet = dynamic(
  () => import("@/src/components/cart/CartSheet"),
  { ssr: false },
);

export function CartBottomBarClient() {
  return <CartSheet />;
}