import { CartBottomBarClient } from "@/src/components/cart/CartBottomBarClient";
import { Footer } from "@/src/components/layout/Footer";
import { Header } from "@/src/components/layout/Header";
import { BottomNav } from "@/src/components/layout/BottomNav";
import { SiteEditProvider } from "@/src/components/home/SiteEditMode";
import { OrganizationJsonLd } from "@/src/components/seo/OrganizationJsonLd";
import { getSiteContent } from "@/src/lib/site-content";

export default async function MainLayout({ children }: { children: React.ReactNode }) {
  // Один провайдер редактирования на весь сайт: у суперадмина — карандашики и
  // перетаскивание фото, у остальных — read-only контекст, чтобы на реальной странице
  // отображались СОХРАНЁННЫЕ оверрайды (текст по id + картинки и их положение/масштаб).
  // B3/ISR: статус суперадмина здесь БОЛЬШЕ НЕ читаем (cookie форсил динамику) — редактор
  // дочитывает его на клиенте. getSiteContent кэширован (unstable_cache), динамику не
  // форсит, поэтому страницы становятся статическими/ISR.
  const content = await getSiteContent();

  return (
    <SiteEditProvider content={content}>
      <OrganizationJsonLd />
      <Header />
      <div className="flex-1">{children}</div>
      <Footer />
      <a href="#" aria-label="Наверх" className="fixed bottom-32 right-5 z-40 hidden rounded-full bg-white p-3 shadow-md transition hover:bg-cream xl:flex">
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
          <path d="M10 15V5M10 5L5 10M10 5l5 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </a>
      <CartBottomBarClient />
      <BottomNav />
    </SiteEditProvider>
  );
}
