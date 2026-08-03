import Link from "next/link";
import { InstagramIcon, WhatsAppIcon } from "@/src/components/ui/BrandIcons";
import { formatDeliveryDaysLabel, getSiteContent } from "@/src/lib/site-content";
import { EditableText } from "@/src/components/home/SiteEditMode";
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
      person: t("Менеджер"),
    },
    {
      label: t("Телефон"),
      value: content.contactPhone,
      href: `tel:+${digits(content.contactPhone)}`,
      icon: WhatsAppIcon,
      person: "Евгений",
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
    <footer className="print-hidden bg-espresso text-white">
      <div className="mx-auto grid max-w-7xl gap-8 px-5 pb-8 pt-14 lg:grid-cols-[1fr_1.4fr] lg:gap-16 lg:px-8">
        <div>
          <Link href="/" className="inline-flex flex-col leading-none" aria-label="DC Bakery">
            <span className="font-display text-xl font-extrabold uppercase tracking-[.13em] text-white">
              DC BAKERY
            </span>
            <span className="mt-1 text-[10px] font-semibold uppercase tracking-[.16em] text-accent-300">
              by del Cappuccino
            </span>
          </Link>
          <p className="mt-5 max-w-md text-sm leading-6 text-white/70">
            <EditableText
              field="footer.tagline"
              multiline
              fallback={t(
                "B2B-каталог десертов, полуфабрикатов и мясных позиций для кофеен, ресторанов, магазинов и отелей.",
              )}
            />
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {contactItems.map((item) => (
            <div key={item.label} className="rounded-md border border-white/15 bg-white/[0.06] p-4">
              <p className="text-[10px] font-bold uppercase tracking-[.12em] text-accent-300">{item.label}</p>
              {item.href ? (
                <a
                  className="mt-2 flex items-center gap-2 break-words text-sm font-semibold text-white hover:text-accent-300"
                  href={item.href}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {item.icon ? <item.icon className="h-4 w-4 shrink-0" /> : null}
                  {item.value}
                </a>
              ) : (
                <p className="mt-2 text-sm font-semibold text-white">{item.value}</p>
              )}
              {"person" in item && item.person ? (
                <p className="mt-1 text-xs text-white/55">{item.person}</p>
              ) : null}
              {"hint" in item && item.hint ? (
                <p className="mt-1 text-xs text-white/55">{item.hint}</p>
              ) : null}
            </div>
          ))}
        </div>
      </div>

      <div className="border-t border-white/15 px-5 pb-[calc(1.5rem+68px)] pt-5 lg:pb-6 lg:px-8">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-5 gap-y-2">
          <Link href="/oferta" className="text-sm text-white/70 transition hover:text-white">{t("Публичная оферта")}</Link>
          <Link href="/privacy" className="text-sm text-white/70 transition hover:text-white">{t("Политика конфиденциальности")}</Link>
          <Link href="/oplata-i-dostavka" className="text-sm text-white/70 transition hover:text-white">{t("Оплата и доставка")}</Link>
          <Link href="/contacts" className="text-sm text-white/70 transition hover:text-white">{t("Контакты и реквизиты")}</Link>
          <p className="ml-auto text-sm text-white/45">© {new Date().getFullYear()} DC Bakery</p>
        </div>
      </div>
    </footer>
  );
}
