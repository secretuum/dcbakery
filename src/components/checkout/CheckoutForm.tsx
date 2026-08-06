"use client";

import { useEffect, useMemo, useRef, useState, useSyncExternalStore, type FormEvent } from "react";
import { LocaleLink as Link } from "@/src/i18n/LocaleLink";
import { useRouter } from "next/navigation";
import { MIN_ORDER_AMOUNT, deliveryFee } from "@/app/constants";
import { isOverLiteCap, LITE_ORDER_CAP } from "@/src/lib/account/tier";
import { Button } from "@/src/components/ui/Button";
import { Input } from "@/src/components/ui/Input";
import { useCart } from "@/src/contexts/CartContext";
import { useToast } from "@/src/contexts/ToastContext";
import { formatPrice } from "@/src/lib/format";
import { gaItem, trackEvent } from "@/src/lib/analytics";
import { isValidKzMobile } from "@/src/lib/phone";
import { useLocale, useT } from "@/src/i18n/client";
import type { Locale } from "@/src/i18n/config";
import type { TranslateVars, Translator } from "@/src/i18n/translate";
import { withLocale } from "@/src/i18n/routing";
import { CheckoutAuthGate } from "@/src/components/checkout/CheckoutAuthGate";

type CheckoutFormState = {
  company_name: string;
  customer_bin: string;
  customer_email: string;
  customer_name: string;
  customer_phone: string;
  delivery_address: string;
  delivery_date: string;
  delivery_time: string;
  payment_method: string;
  comment: string;
  oferta_accepted: boolean;
};

type CheckoutFormErrors = Partial<Record<keyof CheckoutFormState, string>>;

const fieldClassName =
  "min-h-[52px] w-full rounded-md border-[1.5px] border-black/10 bg-white px-4 py-3.5 text-[15px] text-dark outline-none transition placeholder:text-muted-light hover:border-black/[.16] focus:border-coral focus:ring-4 focus:ring-coral/15";

const DELIVERY_WINDOW_DAYS = 14;
// Дефолты дублируют defaultSiteContent — используются, пока настройки не загрузились
const DEFAULT_DELIVERY_DAYS = [2, 4, 6];
const DEFAULT_CUTOFF_HOUR = 18;

type DeliverySchedule = {
  /** Дни доставки: 0 = воскресенье … 6 = суббота */
  deliveryDays: number[];
  /** Приём заявок до этого часа накануне дня доставки */
  cutoffHour: number;
};

function toDateString(input: Date) {
  const date = new Date(input);
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
  return date.toISOString().slice(0, 10);
}

type DeliveryDateOption = {
  value: string;
  disabled: boolean;
  reason?: string;
  weekdayLabel: string;
  dayLabel: string;
};

// Формат дат календаря зависит от языка интерфейса, а не от исходного русского
const INTL_LOCALES: Record<Locale, string> = {
  kk: "kk-KZ",
  ru: "ru-RU",
  en: "en-US",
};

// Ключи словаря — русские сокращения; без переводчика отдаём оригинал
const shortDayLabels = ["вс", "пн", "вт", "ср", "чт", "пт", "сб"];

export function formatShortDeliveryDays(days: number[], t?: Translator) {
  return days
    .slice()
    .sort((a, b) => (a === 0 ? 7 : a) - (b === 0 ? 7 : b))
    .map((d) => {
      const label = shortDayLabels[d] ?? "";
      return label && t ? t(label) : label;
    })
    .filter(Boolean)
    .join(" · ");
}

// Доставка в день X возможна, если заявка успевает до отсечки накануне:
// сегодня минимум за 2 дня до X, либо ровно накануне и сейчас раньше cutoffHour.
function getDeliveryDateOptions(
  schedule: DeliverySchedule,
  intlLocale: string = INTL_LOCALES.ru,
): DeliveryDateOption[] {
  const weekdayFormat = new Intl.DateTimeFormat(intlLocale, { weekday: "short" });
  const dayFormat = new Intl.DateTimeFormat(intlLocale, { day: "numeric", month: "short" });
  const now = new Date();
  const start = new Date(now);
  start.setDate(start.getDate() + 1);

  return Array.from({ length: DELIVERY_WINDOW_DAYS }, (_, i) => {
    const date = new Date(start);
    date.setDate(start.getDate() + i);
    const isDeliveryDay = schedule.deliveryDays.includes(date.getDay());
    const beforeCutoff = i >= 1 || now.getHours() < schedule.cutoffHour;

    return {
      value: toDateString(date),
      disabled: !isDeliveryDay || !beforeCutoff,
      // Ключи словаря (подстановка ${schedule.cutoffHour} — при выводе через t)
      reason: !isDeliveryDay
        ? "В этот день доставки нет"
        : !beforeCutoff
          ? "Приём заявок на эту дату закрыт в ${schedule.cutoffHour}:00"
          : undefined,
      weekdayLabel: weekdayFormat.format(date),
      dayLabel: dayFormat.format(date).replace(".", ""),
    };
  });
}

function isDeliveryDayDate(value: string, schedule: DeliverySchedule) {
  return schedule.deliveryDays.includes(new Date(`${value}T00:00:00`).getDay());
}

const emptySubscribe = () => () => {};

function formatPhone(value: string) {
  const digits = value.replace(/\D/g, "");

  if (!digits) {
    return "";
  }

  const normalized = `${digits.startsWith("8") ? "7" : digits.startsWith("7") ? "" : "7"}${
    digits.startsWith("8") ? digits.slice(1) : digits
  }`.slice(0, 11);
  const code = normalized.slice(1, 4);
  const first = normalized.slice(4, 7);
  const second = normalized.slice(7, 9);
  const third = normalized.slice(9, 11);

  let formatted = "+7";

  if (code) {
    formatted += ` (${code}`;
  }

  if (code.length === 3) {
    formatted += ")";
  }

  if (first) {
    formatted += ` ${first}`;
  }

  if (second) {
    formatted += `-${second}`;
  }

  if (third) {
    formatted += `-${third}`;
  }

  return formatted;
}

function validateForm(form: CheckoutFormState, schedule: DeliverySchedule) {
  const errors: CheckoutFormErrors = {};
  const minDeliveryDate = getDeliveryDateOptions(schedule).find((option) => !option.disabled)?.value ?? "";

  if (!form.company_name.trim()) {
    errors.company_name = "Укажите название компании или заведения";
  }

  if (!form.customer_name.trim()) {
    errors.customer_name = "Укажите контактное лицо";
  }

  if (!isValidKzMobile(form.customer_phone)) {
    errors.customer_phone = "Укажите корректный мобильный номер, например +7 705 123 45 67";
  }

  if (!form.delivery_date) {
    errors.delivery_date = "Выберите дату доставки";
  } else if (!isDeliveryDayDate(form.delivery_date, schedule)) {
    // Ключ словаря: список дней подставляется при выводе (см. FieldError vars)
    errors.delivery_date = "Доставка по этим дням: ${formatShortDeliveryDays(schedule.deliveryDays)}";
  } else if (!minDeliveryDate || form.delivery_date < minDeliveryDate) {
    errors.delivery_date = "Эта дата уже недоступна, выберите более позднюю";
  }

  if (!form.oferta_accepted) {
    errors.oferta_accepted = "Необходимо принять условия оферты";
  }

  return errors;
}

function FieldError({ children, vars }: { children?: string; vars?: TranslateVars }) {
  const t = useT();

  if (!children) {
    return null;
  }

  return <p className="mt-2 text-xs font-bold text-burgundy">{t(children, vars)}</p>;
}

type CheckoutFormProps = {
  deliveryDays?: number[];
  cutoffHour?: number;
};

export function CheckoutForm({
  deliveryDays = DEFAULT_DELIVERY_DAYS,
  cutoffHour = DEFAULT_CUTOFF_HOUR,
}: CheckoutFormProps) {
  const router = useRouter();
  const t = useT();
  const locale = useLocale();
  const { clear, isReady, items, totalAmount, totalItems } = useCart();
  const { showToast } = useToast();

  // Начало оформления — середина воронки. Один раз, когда корзина готова и не пуста.
  const beganCheckout = useRef(false);
  useEffect(() => {
    if (beganCheckout.current || !isReady || totalItems <= 0) return;
    beganCheckout.current = true;
    trackEvent("begin_checkout", {
      currency: "KZT",
      value: totalAmount,
      items: items.map((item) => gaItem(item.product, item.qty)),
    });
  }, [isReady, totalItems, totalAmount, items]);
  // Массив с сервера пересоздаётся на каждый рендер — мемоизируем по содержимому
  const deliveryDaysKey = deliveryDays.join(",");
  const schedule = useMemo<DeliverySchedule>(
    () => ({
      deliveryDays: deliveryDaysKey
        ? deliveryDaysKey.split(",").map(Number)
        : DEFAULT_DELIVERY_DAYS,
      cutoffHour,
    }),
    [deliveryDaysKey, cutoffHour],
  );
  // Даты считаем только на клиенте: страница пререндерится статически, и дата из билда
  // не совпала бы с датой клиента при гидрации
  const isMounted = useSyncExternalStore(emptySubscribe, () => true, () => false);
  const intlLocale = INTL_LOCALES[locale] ?? INTL_LOCALES.ru;
  const deliveryOptions = useMemo(
    () => (isMounted ? getDeliveryDateOptions(schedule, intlLocale) : null),
    [isMounted, schedule, intlLocale],
  );
  const firstAvailableDate = deliveryOptions?.find((option) => !option.disabled)?.value ?? "";
  const hasQuoteItems = items.some((item) => item.product.price <= 0);
  const canCheckout = totalAmount >= MIN_ORDER_AMOUNT;
  const [errors, setErrors] = useState<CheckoutFormErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showAuthGate, setShowAuthGate] = useState(false);
  // Тир аккаунта: null пока грузится. Управляет нотисом предоплаты и клиентским потолком.
  const [tier, setTier] = useState<"lite" | "full" | null>(null);
  const isNavigatingRef = useRef(false);
  const [form, setForm] = useState<CheckoutFormState>({
    company_name: "",
    customer_bin: "",
    customer_email: "",
    customer_name: "",
    customer_phone: "",
    delivery_address: "",
    delivery_date: "",
    delivery_time: "День 12-18",
    payment_method: "Выставить счет",
    comment: "",
    oferta_accepted: false,
  });

  useEffect(() => {
    if (isReady && items.length === 0 && !isNavigatingRef.current) {
      router.replace(withLocale("/catalog", locale));
    }
  }, [isReady, items.length, router, locale]);

  // Тир аккаунта — для нотиса предоплаты и клиентского потолка на лайте.
  useEffect(() => {
    fetch("/api/profile/client-session", { cache: "no-store" })
      .then((r) => r.json())
      .then((d: { tier?: "lite" | "full" }) => {
        if (d.tier) setTier(d.tier);
      })
      .catch(() => undefined);
  }, []);

  // Пока пользователь не выбрал дату сам — подставляется ближайшая доступная
  const selectedDeliveryDate = form.delivery_date || firstAvailableDate;

  function updateField<Field extends keyof CheckoutFormState>(
    field: Field,
    value: CheckoutFormState[Field],
  ) {
    setForm((currentForm) => ({ ...currentForm, [field]: value }));
    setErrors((currentErrors) => ({ ...currentErrors, [field]: undefined }));
  }

  async function isClientAuthed() {
    try {
      const response = await fetch("/api/profile/client-session", { cache: "no-store" });
      const data = (await response.json().catch(() => ({}))) as { authenticated?: boolean };
      return Boolean(data.authenticated);
    } catch {
      return false;
    }
  }

  // Отправка заказа — логика запроса не менялась; patch добирает поля,
  // заполненные в гейте регистрации (email/БИН).
  async function submitOrder(patch?: Partial<CheckoutFormState>) {
    const submission = { ...form, ...patch, delivery_date: selectedDeliveryDate };
    setIsSubmitting(true);

    try {
      const response = await fetch("/api/orders", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...submission,
          items: items.map((item) => ({
            price: item.product.price,
            product_id: item.product.id,
            product_name: item.product.name,
            qty: item.qty,
            total_amount: item.product.price * item.qty,
            unit: item.product.unit,
          })),
        }),
      });

      if (!response.ok) {
        showToast(t("Не удалось отправить заявку, проверьте данные"), "error");
        return;
      }

      const result = (await response.json()) as { orderId?: string; orderNumber?: string };
      const orderNumber = result.orderNumber ?? "DCB";
      const orderIdParam = result.orderId ? `&id=${encodeURIComponent(result.orderId)}` : "";
      // Сумма для конверсии purchase (ROAS): товары + доставка. Считаем до clear().
      const orderTotal = Math.round(totalAmount + deliveryFee(totalAmount));

      isNavigatingRef.current = true;
      clear();
      showToast(t("Заявка отправлена"), "success");
      router.push(
        withLocale(
          `/order-success?n=${encodeURIComponent(orderNumber)}${orderIdParam}&amount=${orderTotal}`,
          locale,
        ),
      );
    } catch {
      showToast(t("Ошибка отправки, попробуйте снова"), "error");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const submission = { ...form, delivery_date: selectedDeliveryDate };
    const nextErrors = validateForm(submission, schedule);

    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      showToast(t("Проверьте обязательные поля"), "error");
      return;
    }

    if (!canCheckout) {
      showToast(t("Минимальная сумма заказа пока не набрана"), "error");
      return;
    }

    // Потолок суммы для облегчённого аккаунта (клиентская подсказка; сервер тоже
    // проверяет). Полный аккаунт (БИН+адрес или кредит) — без потолка.
    if (tier === "lite" && isOverLiteCap("lite", totalAmount + deliveryFee(totalAmount))) {
      showToast(
        t("Для облегчённого аккаунта лимит заказа ${cap}. Укажите БИН и адрес доставки, чтобы снять потолок.", {
          cap: formatPrice(LITE_ORDER_CAP),
        }),
        "error",
      );
      return;
    }

    // Заказ — только с подтверждённым аккаунтом. Нет сессии → гейт регистрации/входа.
    if (!(await isClientAuthed())) {
      setShowAuthGate(true);
      return;
    }

    await submitOrder();
  }

  if (!isReady || items.length === 0) {
    return (
      <main className="min-h-screen bg-cream px-5 py-16 text-dark lg:px-8">
        <section className="mx-auto max-w-2xl rounded-2xl bg-white p-8 text-center shadow-md">
          <p className="text-[11px] font-bold uppercase tracking-[.12em] text-coral">{t("Оформление")}</p>
          <h1 className="mt-3 font-display text-3xl font-extrabold tracking-tight sm:text-4xl">{t("Проверяем корзину")}</h1>
          <p className="mt-4 text-[15px] leading-7 text-muted">{t("Если корзина пуста, вернем вас в каталог.")}</p>
        </section>
      </main>
    );
  }

  if (!canCheckout) {
    return (
      <main className="min-h-screen bg-cream px-5 py-16 text-dark lg:px-8">
        <section className="mx-auto max-w-2xl rounded-2xl bg-white p-8 text-center shadow-md">
          <p className="text-[11px] font-bold uppercase tracking-[.12em] text-coral">{t("Минимальный заказ")}</p>
          <h1 className="mt-3 font-display text-3xl font-extrabold tracking-tight sm:text-4xl">{t("Нужно добрать корзину")}</h1>
          <p className="mt-4 text-[15px] leading-7 text-muted">
            {t("Для B2B-заявки минимальная сумма составляет ${amount}.", {
              amount: formatPrice(MIN_ORDER_AMOUNT),
            })}
          </p>
          <Link
            href="/cart"
            className="mt-6 inline-flex min-h-12 items-center justify-center rounded-btn bg-coral px-6 py-3 text-[15px] font-semibold text-white transition hover:bg-coral-hover"
          >{t("Вернуться в корзину")}</Link>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-cream px-5 pb-24 pt-10 text-dark lg:px-8 lg:pb-14 lg:pt-14">
      <section className="mx-auto max-w-[1240px]">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[.12em] text-coral">{t("Оформление заявки")}</p>
          <h1 className="mt-2 font-display text-3xl font-extrabold leading-tight tracking-tight sm:text-4xl lg:text-[clamp(30px,4vw,44px)]">{t("Контакты и доставка")}</h1>
          <p className="mt-4 max-w-2xl text-[15px] leading-7 text-muted">{t("Заполните контакты и удобное время доставки — менеджер подтвердит заявку и пришлёт счёт в WhatsApp.")}</p>
        </div>

        <div className="mt-8 grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1fr)_388px] lg:items-start">
          <form
            onSubmit={handleSubmit}
            className="min-w-0 rounded-2xl bg-white p-5 shadow-md sm:p-8"
          >
            {/* Контакты */}
            <div className="pb-6">
              <p className="mb-4 text-[11px] font-bold uppercase tracking-[.12em] text-coral">{t("Контакты")}</p>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <label className="block sm:col-span-2">
                  <span className="mb-2 block text-[13.5px] font-semibold text-dark">
                    {t("Название компании / заведения")} <span className="text-coral">*</span>
                  </span>
                  <Input
                    value={form.company_name}
                    onChange={(event) => updateField("company_name", event.currentTarget.value)}
                    placeholder={t("Например, Coffee Point")}
                  />
                  <FieldError>{errors.company_name}</FieldError>
                </label>

                <label className="block sm:col-span-2">
                  <span className="mb-2 block text-[13.5px] font-semibold text-dark">{t("БИН / ИП")}</span>
                  <Input
                    value={form.customer_bin}
                    onChange={(event) => updateField("customer_bin", event.currentTarget.value)}
                    placeholder={t("Например, 123456789012")}
                  />
                </label>

                <label className="block">
                  <span className="mb-2 block text-[13.5px] font-semibold text-dark">
                    {t("Контактное лицо")} <span className="text-coral">*</span>
                  </span>
                  <Input
                    value={form.customer_name}
                    onChange={(event) => updateField("customer_name", event.currentTarget.value)}
                    placeholder={t("Имя менеджера")}
                  />
                  <FieldError>{errors.customer_name}</FieldError>
                </label>

                <label className="block">
                  <span className="mb-2 block text-[13.5px] font-semibold text-dark">
                    {t("Телефон")} <span className="text-coral">*</span>
                  </span>
                  <Input
                    inputMode="tel"
                    value={form.customer_phone}
                    onChange={(event) =>
                      updateField("customer_phone", formatPhone(event.currentTarget.value))
                    }
                    placeholder="+7 (___) ___-__-__"
                  />
                  <FieldError>{errors.customer_phone}</FieldError>
                </label>

                <label className="block sm:col-span-2">
                  <span className="mb-2 block text-[13.5px] font-semibold text-dark">{t("Email для документов")}</span>
                  <Input
                    inputMode="email"
                    type="email"
                    value={form.customer_email}
                    onChange={(event) => updateField("customer_email", event.currentTarget.value)}
                    placeholder="accounting@example.com"
                  />
                </label>
              </div>
            </div>

            {/* Доставка */}
            <div className="border-t border-black/10 py-6">
              <p className="mb-4 text-[11px] font-bold uppercase tracking-[.12em] text-coral">{t("Доставка")}</p>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <label className="block sm:col-span-2">
                  <span className="mb-2 block text-[13.5px] font-semibold text-dark">{t("Адрес доставки")}</span>
                  <Input
                    value={form.delivery_address}
                    onChange={(event) => updateField("delivery_address", event.currentTarget.value)}
                    placeholder={t("Город, улица, дом, точка")}
                  />
                </label>

                <div className="min-w-0 sm:col-span-2">
                  <span className="mb-2 block text-[13.5px] font-semibold text-dark">
                    {t("Дата доставки")} <span className="text-coral">*</span>
                  </span>
                  {deliveryOptions ? (
                    <div className="no-scrollbar flex max-w-full gap-2 overflow-x-auto pb-1">
                      {deliveryOptions.map((option) => {
                        const isSelected = selectedDeliveryDate === option.value;

                        return (
                          <button
                            key={option.value}
                            type="button"
                            disabled={option.disabled}
                            onClick={() => updateField("delivery_date", option.value)}
                            aria-pressed={isSelected}
                            title={
                              option.reason
                                ? t(option.reason, { "schedule.cutoffHour": schedule.cutoffHour })
                                : undefined
                            }
                            className={`flex min-w-[76px] shrink-0 flex-col items-center rounded-md border-[1.5px] px-2.5 py-2.5 text-center transition ${
                              isSelected
                                ? "border-coral bg-coral text-white"
                                : option.disabled
                                  ? "cursor-not-allowed border-transparent bg-black/5 text-muted-light line-through"
                                  : "border-black/10 bg-white text-dark hover:border-coral"
                            }`}
                          >
                            <span
                              className={`text-[10px] font-medium uppercase tracking-wide ${
                                isSelected ? "text-white/75" : "text-muted"
                              }`}
                            >
                              {option.weekdayLabel}
                            </span>
                            <span className="mt-0.5 whitespace-nowrap text-[13.5px] font-bold">
                              {option.dayLabel}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="h-[3.75rem] rounded-md border-[1.5px] border-black/10 bg-black/5" />
                  )}
                  <p className="mt-2 text-xs leading-5 text-muted">
                    {t("Доставка: ${days}. Приём заявок до ${hour}:00 накануне дня доставки.", {
                      days: formatShortDeliveryDays(schedule.deliveryDays, t),
                      hour: schedule.cutoffHour,
                    })}
                  </p>
                  <FieldError
                    vars={{
                      "formatShortDeliveryDays(schedule.deliveryDays)": formatShortDeliveryDays(
                        schedule.deliveryDays,
                        t,
                      ),
                    }}
                  >
                    {errors.delivery_date}
                  </FieldError>
                </div>

                <label className="block">
                  <span className="mb-2 block text-[13.5px] font-semibold text-dark">{t("Время")}</span>
                  <select
                    className={fieldClassName}
                    value={form.delivery_time}
                    onChange={(event) => updateField("delivery_time", event.currentTarget.value)}
                  >
                    {/* value — исходные русские значения: они уходят в заявку, переводится только подпись */}
                    <option value="Утро 8-12">{t("Утро 8-12")}</option>
                    <option value="День 12-18">{t("День 12-18")}</option>
                    <option value="Договориться с менеджером">{t("Договориться с менеджером")}</option>
                  </select>
                </label>
              </div>
            </div>

            {/* Оплата и документы */}
            <div className="border-t border-black/10 py-6">
              <p className="mb-4 text-[11px] font-bold uppercase tracking-[.12em] text-coral">{t("Оплата и документы")}</p>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {/* Оплата всегда по счёту — выбор не показываем, значение уходит в заявку по умолчанию */}
                <p className="rounded-md bg-cream px-4 py-3.5 text-[15px] font-semibold text-dark sm:col-span-2">
                  {t("Оплата — по счёту на оплату.")}
                  <span className="mt-1 block text-xs font-semibold leading-5 text-muted">
                    {t("После подтверждения заявки менеджер выставит счёт с реквизитами.")}
                  </span>
                </p>

                <label className="block sm:col-span-2">
                  <span className="mb-2 block text-[13.5px] font-semibold text-dark">{t("Комментарий")}</span>
                  <textarea
                    className={`${fieldClassName} min-h-[120px] resize-y`}
                    value={form.comment}
                    onChange={(event) => updateField("comment", event.currentTarget.value)}
                    placeholder={t("Особые условия, удобный контакт, детали доставки")}
                  />
                </label>
              </div>
            </div>

            {/* Оферта */}
            <div className="border-t border-black/10 py-6">
              <label className="flex cursor-pointer items-start gap-3 rounded-md bg-cream px-4 py-3.5">
                <input
                  checked={form.oferta_accepted}
                  className="mt-0.5 size-4 shrink-0 accent-coral"
                  type="checkbox"
                  onChange={(event) => updateField("oferta_accepted", event.currentTarget.checked)}
                />
                <span className="text-[13.5px] font-semibold leading-6 text-dark">
                  {t("Я ознакомлен(а) и принимаю условия")}{" "}
                  <a
                    href="/oferta"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-bold text-coral hover:underline"
                    onClick={(e) => e.stopPropagation()}
                  >{t("Публичной оферты")}</a>{" "}
                  {t("и")}{" "}
                  <a
                    href="/privacy"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-bold text-coral hover:underline"
                    onClick={(e) => e.stopPropagation()}
                  >{t("Политики конфиденциальности")}</a>
                </span>
              </label>
              <FieldError>{errors.oferta_accepted}</FieldError>
            </div>

            <div className="flex flex-col gap-3 border-t border-black/10 pt-6 sm:flex-row sm:items-center sm:justify-between">
              <Link href="/cart" className="inline-flex min-h-11 items-center text-[13.5px] font-semibold text-muted transition hover:text-dark">{t("Вернуться в корзину")}</Link>
              <Button type="submit" disabled={isSubmitting} className="min-h-12 px-6">
                {isSubmitting ? t("Отправляем...") : t("Отправить заявку")}
              </Button>
            </div>
          </form>

          <aside className="rounded-2xl bg-white p-6 shadow-md lg:sticky lg:top-28">
            <p className="text-[11px] font-bold uppercase tracking-[.12em] text-coral">{t("Сводка")}</p>
            <h2 className="mt-2 font-display text-[17px] font-extrabold tracking-tight">{t("Ваш заказ")}</h2>
            <div className="mt-6 space-y-3">
              <div className="flex gap-3 text-[13.5px]">
                <span className="text-muted">{t("Товаров")}</span>
                <span className="ml-auto font-semibold tabular-nums">{totalItems}</span>
              </div>
              <div className="flex gap-3 text-[13.5px]">
                <span className="text-muted">{t("Позиций")}</span>
                <span className="ml-auto font-semibold tabular-nums">{items.length}</span>
              </div>
              <div className="flex gap-3 text-[13.5px]">
                <span className="text-muted">{t("Доставка")}</span>
                <span className={`ml-auto font-semibold tabular-nums ${deliveryFee(totalAmount) === 0 ? "text-success" : ""}`}>
                  {deliveryFee(totalAmount) === 0 ? t("Бесплатно") : formatPrice(deliveryFee(totalAmount))}
                </span>
              </div>
              <div className="flex items-end gap-3 border-t border-black/10 pt-3">
                <span className="text-[13.5px] text-muted">{t("Итого")}</span>
                <span className="ml-auto font-display text-2xl font-extrabold tabular-nums text-coral">{formatPrice(totalAmount + deliveryFee(totalAmount))}</span>
              </div>
            </div>

            {hasQuoteItems ? (
              <p className="mt-5 rounded-md bg-coral-light px-4 py-3 text-xs font-semibold leading-5 text-burgundy">{t("В заявке есть товары с ценой по запросу. Менеджер подтвердит их стоимость отдельно.")}</p>
            ) : null}

            {tier === "lite" ? (
              <p className="mt-5 rounded-md border border-coral/20 bg-accent-50 px-4 py-3 text-xs font-semibold leading-5 text-dark/70">
                {t("По этому заказу — предоплата: счёт придёт в WhatsApp, отгрузка после оплаты. Укажите БИН и адрес доставки — аккаунт станет полным, потолок суммы снимется.")}
              </p>
            ) : null}
          </aside>
        </div>
      </section>

      {showAuthGate ? (
        <CheckoutAuthGate
          prefill={{
            company: form.company_name,
            phone: form.customer_phone,
            email: form.customer_email,
            name: form.customer_name,
            bin: form.customer_bin,
          }}
          onClose={() => setShowAuthGate(false)}
          onAuthenticated={(patch) => {
            if (patch?.customer_email) updateField("customer_email", patch.customer_email);
            if (patch?.customer_bin) updateField("customer_bin", patch.customer_bin);
            setShowAuthGate(false);
            void submitOrder(patch);
          }}
        />
      ) : null}
    </main>
  );
}
