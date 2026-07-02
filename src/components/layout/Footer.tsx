import Link from "next/link";

const contactItems = [
  { label: "Телефон", value: "+7 (705) 886-50-14", href: "tel:+77058865014" },
  { label: "WhatsApp", value: "+7 (705) 886-50-14", href: "https://wa.me/77058865014" },
  { label: "Адрес", value: "Адрес производства уточняется", href: null },
  { label: "Соцсети", value: "@dcbakery", href: null },
];

export function Footer() {
  return (
    <footer className="print-hidden border-t border-black/10 bg-white">
      <div className="mx-auto grid max-w-7xl gap-8 px-5 py-10 lg:grid-cols-[1.2fr_1.8fr] lg:px-8">
        <div>
          <Link href="/" className="inline-flex items-center gap-3" aria-label="DC Bakery">
            <span className="flex size-11 items-center justify-center rounded-card bg-coral text-sm font-black text-white">
              DC
            </span>
            <span className="text-xl font-black tracking-tight text-dark">DC Bakery</span>
          </Link>
          <p className="mt-4 max-w-md text-sm font-medium leading-6 text-muted">
            B2B-каталог десертов, полуфабрикатов и мясных позиций для кофеен,
            ресторанов, магазинов и отелей.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {contactItems.map((item) => (
            <div key={item.label} className="rounded-card bg-cream p-4">
              <p className="text-xs font-black uppercase text-coral">{item.label}</p>
              {item.href ? (
                <a className="mt-2 block text-sm font-bold text-dark hover:text-coral" href={item.href}>
                  {item.value}
                </a>
              ) : (
                <p className="mt-2 text-sm font-bold text-dark">{item.value}</p>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="border-t border-black/10 px-5 pb-20 pt-4">
        <div className="mx-auto flex max-w-7xl flex-col gap-2 text-sm font-medium text-muted sm:flex-row sm:items-center sm:justify-between">
          <p>© {new Date().getFullYear()} DC Bakery</p>
          <p>Оптовые заявки без подключения оплаты на этапе MVP</p>
        </div>
      </div>
    </footer>
  );
}
