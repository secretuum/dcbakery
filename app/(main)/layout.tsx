import { CartBottomBarClient } from "@/src/components/cart/CartBottomBarClient";
import { Footer } from "@/src/components/layout/Footer";
import { Header } from "@/src/components/layout/Header";

export default function MainLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Header />
      <div className="flex-1 pb-52">{children}</div>
      <Footer />
	<div className="h-52" />
      <CartBottomBarClient />
    </>
  );
}
