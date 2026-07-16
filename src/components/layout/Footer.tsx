import Link from "next/link";
import { InstagramIcon, WhatsAppIcon } from "@/src/components/ui/BrandIcons";

const contactItems = [
  {
    label: "Телефон / WhatsApp",
    value: "+7 747 727 2650",
    href: "https://wa.me/77477272650",
    icon: WhatsAppIcon,
  },
  {
    label: "Instagram",
    value: "@dcbakery",
    href: "https://www.instagram.com/dcbakery",
    icon: InstagramIcon,
  },
  {
    label: "Адрес",
    value: process.env.DC_LEGAL_ADDRESS ?? "г. Алматы, ул. Жамбыла 154",
    href: null,
    icon: null,
  },
];

export function Footer() {
  return (
    <footer className="print-hidden border-t border-black/10 bg-white">
      <div className="mx-auto grid max-w-7xl gap-8 px-5 py-10 lg:grid-cols-[1.2fr_1.8fr] lg:px-8">
        <div>
          <Link href="/" className="inline-block" aria-label="DC Bakery">
            <span className="font-display text-xl font-bold uppercase tracking-[.12em] text-dark">
              DC BAKERY
            </span>
          </Link>
          <p className="mt-4 max-w-md text-sm leading-6 text-muted">
            B2B-каталог десертов, полуфабрикатов и мясных позиций для кофеен,
            ресторанов, магазинов и отелей.
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {contactItems.map((item) => (
            <div key={item.label} className="border border-black/10 bg-cream p-4">
              <p className="text-[10px] font-bold uppercase tracking-[.1em] text-coral">{item.label}</p>
              {item.href ? (
                <a
                  className="mt-2 flex items-center gap-2 text-sm font-semibold text-dark hover:text-coral"
                  href={item.href}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {item.icon ? <item.icon className="h-4 w-4 shrink-0" /> : null}
                  {item.value}
                </a>
              ) : (
                <p className="mt-2 text-sm font-semibold text-dark">{item.value}</p>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="border-t border-black/10 px-5 pb-20 pt-4">
        <div className="mx-auto max-w-7xl space-y-3">
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
            <p className="text-[10px] font-bold uppercase tracking-[.1em] text-muted/60">Правовая информация</p>
            <Link href="/oferta" className="text-sm text-muted transition hover:text-dark">Публичная оферта</Link>
            <Link href="/privacy" className="text-sm text-muted transition hover:text-dark">Политика конфиденциальности</Link>
            <Link href="/oplata-i-dostavka" className="text-sm text-muted transition hover:text-dark">Оплата и доставка</Link>
            <Link href="/contacts" className="text-sm text-muted transition hover:text-dark">Контакты и реквизиты</Link>
          </div>
          <p className="text-sm text-muted">© {new Date().getFullYear()} DC Bakery</p>
        </div>
      </div>
    </footer>
  );
}
