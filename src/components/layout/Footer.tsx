import Link from "next/link";
import { InstagramIcon, WhatsAppIcon } from "@/src/components/ui/BrandIcons";
import { formatDeliveryDaysLabel, getSiteContent } from "@/src/lib/site-content";
import { getT } from "@/src/i18n/server";

// Единый блок контактов сайта (дубль на главной удалён — контакты живут здесь).
// Значения редактируются суперадмином: Настройки → «Контент сайта» или карандашиком на главной.

function digits(value: string) {
  return value.replace(/\D/g, "");
}

export async function Footer() {
  const [content, t] = await Promise.all([getSiteContent(), getT()]);
  const deliveryDaysLabel = formatDeliveryDaysLabel(content.deliveryDays)
    .split(" · ")
    .map((day) => t(day))
    .join(" · ");

  const contactItems = [
    {
      label: "WhatsApp",
      value: content.contactWhatsapp,
      href: `https://wa.me/${digits(content.contactWhatsapp)}`,
      icon: WhatsAppIcon,
    },
    {
      label: t("Телефон"),
      value: content.contactPhone,
      href: `tel:+${digits(content.contactPhone)}`,
      icon: WhatsAppIcon,
    },
    {
      label: "Instagram",
      value: "@bakery.dc",
      href: "https://www.instagram.com/bakery.dc",
      icon: InstagramIcon,
    },
    { label: t("Адрес"), value: content.address, href: null, icon: null },
    { label: t("Режим работы"), value: content.workHours, href: null, icon: null },
    {
      label: t("График поставок"),
      value: deliveryDaysLabel,
      hint: t("Приём заявок до ${content.orderCutoffHour}:00 накануне", {
        "content.orderCutoffHour": content.orderCutoffHour,
      }),
      href: null,
      icon: null,
    },
  ];

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
            {t(
              "B2B-каталог десертов, полуфабрикатов и мясных позиций для кофеен, ресторанов, магазинов и отелей.",
            )}
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
              {"hint" in item && item.hint ? (
                <p className="mt-1 text-xs text-muted">{item.hint}</p>
              ) : null}
            </div>
          ))}
        </div>
      </div>

      <div className="border-t border-black/10 px-5 pb-20 pt-4">
        <div className="mx-auto max-w-7xl space-y-3">
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
            <p className="text-[10px] font-bold uppercase tracking-[.1em] text-muted/60">{t("Правовая информация")}</p>
            <Link href="/oferta" className="text-sm text-muted transition hover:text-dark">{t("Публичная оферта")}</Link>
            <Link href="/privacy" className="text-sm text-muted transition hover:text-dark">{t("Политика конфиденциальности")}</Link>
            <Link href="/oplata-i-dostavka" className="text-sm text-muted transition hover:text-dark">{t("Оплата и доставка")}</Link>
            <Link href="/contacts" className="text-sm text-muted transition hover:text-dark">{t("Контакты и реквизиты")}</Link>
          </div>
          <p className="text-sm text-muted">© {new Date().getFullYear()} DC Bakery</p>
        </div>
      </div>
    </footer>
  );
}
