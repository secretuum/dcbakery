import { Footer } from "@/src/components/layout/Footer";
import { Header } from "@/src/components/layout/Header";

export default function MainLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Header />
      <div className="flex-1">{children}</div>
      <Footer />
  href="#"
  aria-label="Наверх"
  className="fixed bottom-32 right-5 z-40 hidden rounded-full bg-white p-3 shadow-lg ring-1 ring-black/10 transition hover:bg-cream xl:flex"
>
  <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
    <path d="M10 15V5M10 5L5 10M10 5l5 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
</a>
    </>
  );
}
