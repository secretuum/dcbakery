"use client";

import dynamic from "next/dynamic";

const CartBottomBar = dynamic(
  () => import("@/src/components/cart/CartBottomBar"),
  { ssr: false },
);

export function CartBottomBarClient() {
  return <CartBottomBar />;
}