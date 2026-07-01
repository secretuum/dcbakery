import { CartBottomBarClient } from "@/src/components/cart/CartBottomBarClient";

export default function CatalogLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <div className="pb-52">{children}</div>
      <CartBottomBarClient />
    </>
  );
}
